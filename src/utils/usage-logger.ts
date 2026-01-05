import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type { TokenUsage } from "./token-counter.js";

/**
 * 개별 사용 기록 항목
 */
export interface UsageLogEntry {
  /** 기록 ID (자동 생성) */
  id: string;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 요일 (월, 화, 수, 목, 금, 토, 일) */
  dayOfWeek: string;
  /** 시간 (HH:MM:SS) */
  time: string;
  /** MR 제목 */
  mrTitle: string;
  /** MR URL */
  mrUrl: string;
  /** 프로젝트 ID */
  projectId: string;
  /** MR IID */
  mrIid: number;
  /** 사용 모델 */
  model: string;
  /** LLM 제공자 (ollama, openai, codex) */
  provider: string;
  /** 토큰 사용량 */
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 예상 청구 금액 (USD) */
  estimatedCostUSD: number;
  /** 예상 청구 금액 (KRW, 환율 1350원 기준) */
  estimatedCostKRW: number;
  /** 처리 상태 */
  status: "success" | "failed";
  /** 에러 메시지 (실패 시) */
  errorMessage?: string;
  /** diff 크기 정보 */
  diffInfo?: {
    fileCount: number;
    totalSizeBytes: number;
    totalLines: number;
  };
}

/**
 * 전체 사용 기록 로그
 */
export interface UsageLog {
  /** 로그 생성일 */
  createdAt: string;
  /** 마지막 업데이트 */
  lastUpdatedAt: string;
  /** 총 기록 수 */
  totalEntries: number;
  /** 총 토큰 사용량 */
  totalTokens: number;
  /** 총 예상 비용 (USD) */
  totalCostUSD: number;
  /** 총 예상 비용 (KRW) */
  totalCostKRW: number;
  /** 개별 기록들 */
  entries: UsageLogEntry[];
}

/**
 * 로그 디렉토리 경로
 */
const LOG_BASE_DIR = join(process.cwd(), "data", "log");
const MONTHLY_DIR = join(LOG_BASE_DIR, "monthly");
const DAILY_DIR = join(LOG_BASE_DIR, "daily");
const ALL_ENTRIES_PATH = join(LOG_BASE_DIR, "all-entries.json");

/**
 * 요일 이름 매핑 (한국어)
 */
const DAY_NAMES_KR = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * USD to KRW 환율 (기본값)
 */
const USD_TO_KRW_RATE = 1450;

/**
 * 모델별 가격 (per 1K tokens, USD)
 */
const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  // GPT-4 계열
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  // GPT-3.5 계열
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  // o1 계열
  "o1": { input: 0.015, output: 0.06 },
  "o1-mini": { input: 0.003, output: 0.012 },
  "o1-preview": { input: 0.015, output: 0.06 },
  // Ollama (로컬) - 비용 없음
  "ollama": { input: 0, output: 0 },
  // Codex CLI (ChatGPT Plus 구독 기준) - 참고용 추정값
  "codex": { input: 0.01, output: 0.03 },
};

/**
 * 빈 로그 객체를 생성합니다.
 */
const createEmptyLog = (): UsageLog => {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    lastUpdatedAt: now,
    totalEntries: 0,
    totalTokens: 0,
    totalCostUSD: 0,
    totalCostKRW: 0,
    entries: [],
  };
};

/**
 * 디렉토리가 없으면 생성합니다.
 */
const ensureDir = (dirPath: string): void => {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * 일별 로그 파일 경로를 반환합니다.
 */
const getDailyLogPath = (date: string): string => join(DAILY_DIR, `${date}.json`);

/**
 * 월별 로그 파일 경로를 반환합니다.
 */
const getMonthlyLogPath = (yearMonth: string): string => join(MONTHLY_DIR, `${yearMonth}.json`);

/**
 * 일별 로그 파일을 읽어옵니다.
 */
export const loadDailyLog = (date: string): UsageLog => {
  const logPath = getDailyLogPath(date);
  if (!existsSync(logPath)) {
    return createEmptyLog();
  }
  try {
    const content = readFileSync(logPath, "utf-8");
    return JSON.parse(content) as UsageLog;
  } catch {
    return createEmptyLog();
  }
};

/**
 * 월별 로그 파일을 읽어옵니다.
 */
export const loadMonthlyLog = (yearMonth: string): UsageLog => {
  const logPath = getMonthlyLogPath(yearMonth);
  if (!existsSync(logPath)) {
    return createEmptyLog();
  }
  try {
    const content = readFileSync(logPath, "utf-8");
    return JSON.parse(content) as UsageLog;
  } catch {
    return createEmptyLog();
  }
};

/**
 * 전체 로그 파일을 읽어옵니다.
 */
export const loadUsageLog = (logPath: string = ALL_ENTRIES_PATH): UsageLog => {
  if (!existsSync(logPath)) {
    return createEmptyLog();
  }

  try {
    const content = readFileSync(logPath, "utf-8");
    return JSON.parse(content) as UsageLog;
  } catch (error) {
    console.error("로그 파일 읽기 실패:", error);
    return createEmptyLog();
  }
};

/**
 * 로그 파일을 저장합니다.
 */
export const saveUsageLog = (log: UsageLog, logPath: string = ALL_ENTRIES_PATH): void => {
  // 디렉토리가 없으면 생성
  const logDir = dirname(logPath);
  ensureDir(logDir);

  // 통계 업데이트
  log.lastUpdatedAt = new Date().toISOString();
  log.totalEntries = log.entries.length;
  log.totalTokens = log.entries.reduce((sum, e) => sum + e.tokenUsage.totalTokens, 0);
  log.totalCostUSD = log.entries.reduce((sum, e) => sum + e.estimatedCostUSD, 0);
  log.totalCostKRW = log.entries.reduce((sum, e) => sum + e.estimatedCostKRW, 0);

  writeFileSync(logPath, JSON.stringify(log, null, 2), "utf-8");
};

/**
 * 일별/월별 로그 파일에도 저장합니다.
 */
const saveToHierarchy = (entry: UsageLogEntry): void => {
  ensureDir(DAILY_DIR);
  ensureDir(MONTHLY_DIR);

  const date = entry.date;
  const yearMonth = date.substring(0, 7);

  // 일별 로그 저장
  const dailyLog = loadDailyLog(date);
  dailyLog.entries.push(entry);
  saveUsageLog(dailyLog, getDailyLogPath(date));

  // 월별 로그 저장
  const monthlyLog = loadMonthlyLog(yearMonth);
  monthlyLog.entries.push(entry);
  saveUsageLog(monthlyLog, getMonthlyLogPath(yearMonth));
};

/**
 * 예상 비용을 계산합니다.
 */
export const calculateCost = (
  promptTokens: number,
  completionTokens: number,
  model: string,
  provider: string
): { usd: number; krw: number } => {
  // 로컬 모델 (Ollama)은 비용 없음
  if (provider === "ollama") {
    return { usd: 0, krw: 0 };
  }

  const normalizedModel = model.toLowerCase();
  let price = MODEL_PRICES[normalizedModel];

  // 모델을 찾지 못한 경우 provider 기반으로 추정
  if (!price) {
    if (provider === "codex") {
      price = MODEL_PRICES["codex"];
    } else if (provider === "openai") {
      price = MODEL_PRICES["gpt-4o"]; // 기본값
    } else {
      price = { input: 0, output: 0 };
    }
  }

  const inputCost = (promptTokens / 1000) * price.input;
  const outputCost = (completionTokens / 1000) * price.output;
  const totalUSD = inputCost + outputCost;
  const totalKRW = totalUSD * USD_TO_KRW_RATE;

  return {
    usd: Math.round(totalUSD * 10000) / 10000, // 소수점 4자리
    krw: Math.round(totalKRW), // 원 단위 반올림
  };
};

/**
 * 고유 ID를 생성합니다.
 */
const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
};

/**
 * 새로운 사용 기록을 추가합니다.
 */
export const addUsageEntry = (
  options: {
    mrTitle: string;
    mrUrl: string;
    projectId: string;
    mrIid: number;
    model: string;
    provider: string;
    tokenUsage: TokenUsage | { promptTokens: number; completionTokens: number; totalTokens: number };
    status: "success" | "failed";
    errorMessage?: string;
    diffInfo?: {
      fileCount: number;
      totalSizeBytes: number;
      totalLines: number;
    };
  }
): UsageLogEntry => {
  const now = new Date();

  // 비용 계산
  const cost = calculateCost(
    options.tokenUsage.promptTokens,
    options.tokenUsage.completionTokens,
    options.model,
    options.provider
  );

  const entry: UsageLogEntry = {
    id: generateId(),
    date: now.toISOString().split("T")[0],
    dayOfWeek: DAY_NAMES_KR[now.getDay()],
    time: now.toTimeString().split(" ")[0],
    mrTitle: options.mrTitle,
    mrUrl: options.mrUrl,
    projectId: options.projectId,
    mrIid: options.mrIid,
    model: options.model,
    provider: options.provider,
    tokenUsage: {
      promptTokens: options.tokenUsage.promptTokens,
      completionTokens: options.tokenUsage.completionTokens,
      totalTokens: options.tokenUsage.totalTokens,
    },
    estimatedCostUSD: cost.usd,
    estimatedCostKRW: cost.krw,
    status: options.status,
    errorMessage: options.errorMessage,
    diffInfo: options.diffInfo,
  };

  // 전체 로그 파일 저장
  ensureDir(LOG_BASE_DIR);
  const log = loadUsageLog();
  log.entries.push(entry);
  saveUsageLog(log);

  // 월별/일별 로그에도 저장
  saveToHierarchy(entry);

  return entry;
};

/**
 * 사용 통계를 계산합니다.
 */
export interface UsageStatistics {
  /** 기간 내 총 요청 수 */
  totalRequests: number;
  /** 성공한 요청 수 */
  successfulRequests: number;
  /** 실패한 요청 수 */
  failedRequests: number;
  /** 총 토큰 사용량 */
  totalTokens: number;
  /** 평균 토큰 사용량 (요청당) */
  avgTokensPerRequest: number;
  /** 총 예상 비용 (USD) */
  totalCostUSD: number;
  /** 총 예상 비용 (KRW) */
  totalCostKRW: number;
  /** 일별 통계 */
  dailyStats: Record<string, {
    requests: number;
    tokens: number;
    costUSD: number;
    costKRW: number;
  }>;
  /** 모델별 통계 */
  modelStats: Record<string, {
    requests: number;
    tokens: number;
    costUSD: number;
    costKRW: number;
  }>;
}

/**
 * 특정 기간의 사용 통계를 계산합니다.
 */
export const getUsageStatistics = (
  startDate?: string,
  endDate?: string,
  logPath: string = ALL_ENTRIES_PATH
): UsageStatistics => {
  const log = loadUsageLog(logPath);
  
  // 기간 필터링
  let filteredEntries = log.entries;
  if (startDate) {
    filteredEntries = filteredEntries.filter(e => e.date >= startDate);
  }
  if (endDate) {
    filteredEntries = filteredEntries.filter(e => e.date <= endDate);
  }

  const stats: UsageStatistics = {
    totalRequests: filteredEntries.length,
    successfulRequests: filteredEntries.filter(e => e.status === "success").length,
    failedRequests: filteredEntries.filter(e => e.status === "failed").length,
    totalTokens: filteredEntries.reduce((sum, e) => sum + e.tokenUsage.totalTokens, 0),
    avgTokensPerRequest: 0,
    totalCostUSD: filteredEntries.reduce((sum, e) => sum + e.estimatedCostUSD, 0),
    totalCostKRW: filteredEntries.reduce((sum, e) => sum + e.estimatedCostKRW, 0),
    dailyStats: {},
    modelStats: {},
  };

  stats.avgTokensPerRequest = stats.totalRequests > 0
    ? Math.round(stats.totalTokens / stats.totalRequests)
    : 0;

  // 일별 통계
  for (const entry of filteredEntries) {
    if (!stats.dailyStats[entry.date]) {
      stats.dailyStats[entry.date] = { requests: 0, tokens: 0, costUSD: 0, costKRW: 0 };
    }
    stats.dailyStats[entry.date].requests++;
    stats.dailyStats[entry.date].tokens += entry.tokenUsage.totalTokens;
    stats.dailyStats[entry.date].costUSD += entry.estimatedCostUSD;
    stats.dailyStats[entry.date].costKRW += entry.estimatedCostKRW;
  }

  // 모델별 통계
  for (const entry of filteredEntries) {
    const key = `${entry.provider}/${entry.model}`;
    if (!stats.modelStats[key]) {
      stats.modelStats[key] = { requests: 0, tokens: 0, costUSD: 0, costKRW: 0 };
    }
    stats.modelStats[key].requests++;
    stats.modelStats[key].tokens += entry.tokenUsage.totalTokens;
    stats.modelStats[key].costUSD += entry.estimatedCostUSD;
    stats.modelStats[key].costKRW += entry.estimatedCostKRW;
  }

  return stats;
};

/**
 * 통계를 콘솔에 출력합니다.
 */
export const printUsageStatistics = (stats: UsageStatistics): void => {
  console.log("\n📊 사용량 통계");
  console.log("═".repeat(50));
  
  console.log("\n📈 요약:");
  console.log(`  총 요청 수: ${stats.totalRequests.toLocaleString()}건`);
  console.log(`  성공: ${stats.successfulRequests.toLocaleString()}건 / 실패: ${stats.failedRequests.toLocaleString()}건`);
  console.log(`  총 토큰: ${stats.totalTokens.toLocaleString()} tokens`);
  console.log(`  평균 토큰/요청: ${stats.avgTokensPerRequest.toLocaleString()} tokens`);
  
  console.log("\n💰 예상 비용:");
  console.log(`  USD: $${stats.totalCostUSD.toFixed(4)}`);
  console.log(`  KRW: ₩${stats.totalCostKRW.toLocaleString()}`);

  if (Object.keys(stats.dailyStats).length > 0) {
    console.log("\n📅 일별 통계:");
    const sortedDates = Object.keys(stats.dailyStats).sort().reverse().slice(0, 7);
    for (const date of sortedDates) {
      const daily = stats.dailyStats[date];
      console.log(`  ${date}: ${daily.requests}건, ${daily.tokens.toLocaleString()} tokens, ₩${daily.costKRW.toLocaleString()}`);
    }
  }

  if (Object.keys(stats.modelStats).length > 0) {
    console.log("\n🤖 모델별 통계:");
    for (const [model, modelStat] of Object.entries(stats.modelStats)) {
      console.log(`  ${model}: ${modelStat.requests}건, ${modelStat.tokens.toLocaleString()} tokens, ₩${modelStat.costKRW.toLocaleString()}`);
    }
  }

  console.log("\n" + "═".repeat(50));
};

/**
 * 최근 N개의 기록을 가져옵니다.
 */
export const getRecentEntries = (
  count: number = 10,
  logPath: string = ALL_ENTRIES_PATH
): UsageLogEntry[] => {
  const log = loadUsageLog(logPath);
  return log.entries.slice(-count).reverse();
};

/**
 * 월별 통계 인터페이스
 */
export interface MonthlyStatistics {
  /** 월 (YYYY-MM) */
  month: string;
  /** 요청 수 */
  requests: number;
  /** 성공 수 */
  successCount: number;
  /** 실패 수 */
  failedCount: number;
  /** 총 토큰 */
  totalTokens: number;
  /** 평균 토큰/요청 */
  avgTokensPerRequest: number;
  /** 예상 비용 (USD) */
  costUSD: number;
  /** 예상 비용 (KRW) */
  costKRW: number;
  /** 일별 상세 */
  dailyBreakdown: Record<string, { requests: number; tokens: number; costKRW: number }>;
}

/**
 * 월별 통계를 계산합니다.
 */
export const getMonthlyStatistics = (
  logPath: string = ALL_ENTRIES_PATH
): MonthlyStatistics[] => {
  const log = loadUsageLog(logPath);
  
  // 월별로 그룹화
  const monthlyMap = new Map<string, UsageLogEntry[]>();
  
  for (const entry of log.entries) {
    const month = entry.date.substring(0, 7); // YYYY-MM
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, []);
    }
    monthlyMap.get(month)!.push(entry);
  }

  // 월별 통계 계산
  const monthlyStats: MonthlyStatistics[] = [];
  
  for (const [month, entries] of monthlyMap) {
    const successEntries = entries.filter(e => e.status === "success");
    const failedEntries = entries.filter(e => e.status === "failed");
    const totalTokens = entries.reduce((sum, e) => sum + e.tokenUsage.totalTokens, 0);
    const costUSD = entries.reduce((sum, e) => sum + e.estimatedCostUSD, 0);
    const costKRW = entries.reduce((sum, e) => sum + e.estimatedCostKRW, 0);

    // 일별 상세
    const dailyBreakdown: Record<string, { requests: number; tokens: number; costKRW: number }> = {};
    for (const entry of entries) {
      if (!dailyBreakdown[entry.date]) {
        dailyBreakdown[entry.date] = { requests: 0, tokens: 0, costKRW: 0 };
      }
      dailyBreakdown[entry.date].requests++;
      dailyBreakdown[entry.date].tokens += entry.tokenUsage.totalTokens;
      dailyBreakdown[entry.date].costKRW += entry.estimatedCostKRW;
    }

    monthlyStats.push({
      month,
      requests: entries.length,
      successCount: successEntries.length,
      failedCount: failedEntries.length,
      totalTokens,
      avgTokensPerRequest: entries.length > 0 ? Math.round(totalTokens / entries.length) : 0,
      costUSD: Math.round(costUSD * 10000) / 10000,
      costKRW: Math.round(costKRW),
      dailyBreakdown,
    });
  }

  // 월별 정렬 (최신순)
  return monthlyStats.sort((a, b) => b.month.localeCompare(a.month));
};

/**
 * 월별 통계를 콘솔에 출력합니다.
 */
export const printMonthlyStatistics = (
  logPath: string = ALL_ENTRIES_PATH,
  showDailyBreakdown: boolean = false
): void => {
  const monthlyStats = getMonthlyStatistics(logPath);

  if (monthlyStats.length === 0) {
    console.log("\n📊 기록된 사용량이 없습니다.");
    return;
  }

  console.log("\n" + "═".repeat(70));
  console.log("📅 월별 AI 코드 리뷰 사용량 통계");
  console.log("═".repeat(70));

  let grandTotalTokens = 0;
  let grandTotalCostKRW = 0;
  let grandTotalRequests = 0;

  for (const stat of monthlyStats) {
    grandTotalTokens += stat.totalTokens;
    grandTotalCostKRW += stat.costKRW;
    grandTotalRequests += stat.requests;

    console.log(`\n📆 ${stat.month}`);
    console.log("─".repeat(50));
    console.log(`  📊 요청 수: ${stat.requests}건 (성공: ${stat.successCount}, 실패: ${stat.failedCount})`);
    console.log(`  🔤 토큰: ${stat.totalTokens.toLocaleString()} (평균 ${stat.avgTokensPerRequest.toLocaleString()}/요청)`);
    console.log(`  💰 예상 비용: $${stat.costUSD.toFixed(4)} (₩${stat.costKRW.toLocaleString()})`);

    if (showDailyBreakdown) {
      const sortedDays = Object.keys(stat.dailyBreakdown).sort();
      console.log("  📋 일별 상세:");
      for (const day of sortedDays) {
        const daily = stat.dailyBreakdown[day];
        const dayOfWeek = DAY_NAMES_KR[new Date(day).getDay()];
        console.log(`     ${day} (${dayOfWeek}): ${daily.requests}건, ${daily.tokens.toLocaleString()} tokens, ₩${daily.costKRW.toLocaleString()}`);
      }
    }
  }

  console.log("\n" + "═".repeat(70));
  console.log("📈 전체 누적 통계");
  console.log("─".repeat(50));
  console.log(`  총 요청: ${grandTotalRequests.toLocaleString()}건`);
  console.log(`  총 토큰: ${grandTotalTokens.toLocaleString()}`);
  console.log(`  총 예상 비용: ₩${grandTotalCostKRW.toLocaleString()}`);
  console.log("═".repeat(70) + "\n");
};

/**
 * 특정 월의 상세 기록을 출력합니다.
 */
export const printMonthlyDetail = (
  yearMonth: string, // YYYY-MM 형식
  logPath: string = ALL_ENTRIES_PATH
): void => {
  const log = loadUsageLog(logPath);
  const monthEntries = log.entries.filter(e => e.date.startsWith(yearMonth));

  if (monthEntries.length === 0) {
    console.log(`\n📊 ${yearMonth}에 기록된 사용량이 없습니다.`);
    return;
  }

  console.log("\n" + "═".repeat(80));
  console.log(`📆 ${yearMonth} 상세 기록`);
  console.log("═".repeat(80));

  // 날짜별로 그룹화
  const byDate = new Map<string, UsageLogEntry[]>();
  for (const entry of monthEntries) {
    if (!byDate.has(entry.date)) {
      byDate.set(entry.date, []);
    }
    byDate.get(entry.date)!.push(entry);
  }

  for (const [date, entries] of [...byDate].sort((a, b) => a[0].localeCompare(b[0]))) {
    const dayOfWeek = DAY_NAMES_KR[new Date(date).getDay()];
    console.log(`\n📅 ${date} (${dayOfWeek}요일)`);
    console.log("─".repeat(60));

    for (const entry of entries) {
      const status = entry.status === "success" ? "✅" : "❌";
      console.log(`  ${status} ${entry.time} | MR !${entry.mrIid}: ${entry.mrTitle.substring(0, 40)}${entry.mrTitle.length > 40 ? "..." : ""}`);
      console.log(`     🔗 ${entry.mrUrl}`);
      console.log(`     📊 ${entry.tokenUsage.totalTokens.toLocaleString()} tokens | 💰 ₩${entry.estimatedCostKRW.toLocaleString()}`);
      if (entry.errorMessage) {
        console.log(`     ⚠️ 에러: ${entry.errorMessage.substring(0, 50)}...`);
      }
    }
  }

  // 월간 요약
  const totalTokens = monthEntries.reduce((sum, e) => sum + e.tokenUsage.totalTokens, 0);
  const totalCostKRW = monthEntries.reduce((sum, e) => sum + e.estimatedCostKRW, 0);
  
  console.log("\n" + "═".repeat(80));
  console.log(`📊 ${yearMonth} 요약: ${monthEntries.length}건, ${totalTokens.toLocaleString()} tokens, ₩${totalCostKRW.toLocaleString()}`);
  console.log("═".repeat(80) + "\n");
};

/**
 * 기록을 CSV 형식으로 내보냅니다.
 */
export const exportToCSV = (logPath: string = ALL_ENTRIES_PATH): string => {
  const log = loadUsageLog(logPath);
  
  const headers = [
    "ID",
    "날짜",
    "요일",
    "시간",
    "MR 제목",
    "MR URL",
    "프로젝트 ID",
    "MR IID",
    "모델",
    "Provider",
    "프롬프트 토큰",
    "응답 토큰",
    "총 토큰",
    "예상비용(USD)",
    "예상비용(KRW)",
    "상태",
  ];

  const rows = log.entries.map(e => [
    e.id,
    e.date,
    e.dayOfWeek,
    e.time,
    `"${e.mrTitle.replace(/"/g, '""')}"`,
    e.mrUrl,
    e.projectId,
    e.mrIid,
    e.model,
    e.provider,
    e.tokenUsage.promptTokens,
    e.tokenUsage.completionTokens,
    e.tokenUsage.totalTokens,
    e.estimatedCostUSD,
    e.estimatedCostKRW,
    e.status,
  ].join(","));

  return [headers.join(","), ...rows].join("\n");
};
