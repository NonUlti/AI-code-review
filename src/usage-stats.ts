#!/usr/bin/env npx tsx
/**
 * AI 코드 리뷰 사용량 통계 CLI
 * 
 * 사용법:
 *   npx tsx src/usage-stats.ts              # 월별 요약 보기
 *   npx tsx src/usage-stats.ts --daily      # 일별 상세 포함
 *   npx tsx src/usage-stats.ts 2026-01      # 특정 월 상세 보기
 *   npx tsx src/usage-stats.ts --recent 10  # 최근 N개 기록 보기
 *   npx tsx src/usage-stats.ts --export     # CSV 내보내기
 */

import {
  printMonthlyStatistics,
  printMonthlyDetail,
  getRecentEntries,
  exportToCSV,
  loadUsageLog,
  loadMonthlyLog,
  loadDailyLog,
} from "./utils/usage-logger.js";
import { writeFileSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);

const printHelp = () => {
  console.log(`
📊 AI 코드 리뷰 사용량 통계 CLI

사용법:
  npx tsx src/usage-stats.ts [옵션]

옵션:
  (없음)           월별 요약 보기
  --daily, -d      일별 상세 포함해서 월별 통계 보기
  YYYY-MM          특정 월 상세 기록 보기 (예: 2026-01)
  YYYY-MM-DD       특정 일 기록 보기 (예: 2026-01-05)
  --recent N, -r N 최근 N개 기록 보기 (기본: 10)
  --export, -e     CSV 파일로 내보내기
  --json, -j       JSON 원본 데이터 출력
  --files, -f      로그 파일 구조 보기
  --help, -h       이 도움말 보기

예시:
  npx tsx src/usage-stats.ts              # 전체 월별 요약
  npx tsx src/usage-stats.ts --daily      # 일별 상세 포함
  npx tsx src/usage-stats.ts 2026-01      # 2026년 1월 상세
  npx tsx src/usage-stats.ts 2026-01-05   # 2026년 1월 5일 상세
  npx tsx src/usage-stats.ts -r 20        # 최근 20개 기록
  npx tsx src/usage-stats.ts --export     # usage-export.csv 생성

📁 로그 파일 위치:
  data/log/
  ├── all-entries.json     # 전체 기록
  ├── monthly/
  │   └── YYYY-MM.json     # 월별 기록 (예: 2026-01.json)
  └── daily/
      └── YYYY-MM-DD.json  # 일별 기록 (예: 2026-01-05.json)
`);
};

const printRecentEntries = (count: number) => {
  const entries = getRecentEntries(count);

  if (entries.length === 0) {
    console.log("\n📊 기록된 사용량이 없습니다.");
    return;
  }

  console.log("\n" + "═".repeat(80));
  console.log(`📋 최근 ${count}개 AI 코드 리뷰 기록`);
  console.log("═".repeat(80));

  for (const entry of entries) {
    const status = entry.status === "success" ? "✅" : "❌";
    console.log(`\n${status} ${entry.date} (${entry.dayOfWeek}) ${entry.time}`);
    console.log(`   📝 MR !${entry.mrIid}: ${entry.mrTitle}`);
    console.log(`   🔗 ${entry.mrUrl}`);
    console.log(`   🤖 ${entry.provider}/${entry.model}`);
    console.log(`   📊 프롬프트: ${entry.tokenUsage.promptTokens.toLocaleString()} | 응답: ${entry.tokenUsage.completionTokens.toLocaleString()} | 총: ${entry.tokenUsage.totalTokens.toLocaleString()} tokens`);
    console.log(`   💰 예상 비용: $${entry.estimatedCostUSD.toFixed(4)} (₩${entry.estimatedCostKRW.toLocaleString()})`);
    if (entry.diffInfo) {
      console.log(`   📁 파일: ${entry.diffInfo.fileCount}개 | ${(entry.diffInfo.totalSizeBytes / 1024).toFixed(1)}KB`);
    }
    if (entry.errorMessage) {
      console.log(`   ⚠️ 에러: ${entry.errorMessage}`);
    }
  }

  console.log("\n" + "═".repeat(80) + "\n");
};

const exportCSV = () => {
  const csv = exportToCSV();
  const exportPath = join(process.cwd(), "data", "usage-export.csv");
  writeFileSync(exportPath, csv, "utf-8");
  console.log(`\n✅ CSV 파일 생성 완료: ${exportPath}\n`);
};

const printJSON = () => {
  const log = loadUsageLog();
  console.log(JSON.stringify(log, null, 2));
};

const printDailyDetail = (date: string) => {
  const log = loadDailyLog(date);
  
  if (log.entries.length === 0) {
    console.log(`\n📊 ${date}에 기록된 사용량이 없습니다.`);
    return;
  }

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayOfWeek = dayNames[new Date(date).getDay()];

  console.log("\n" + "═".repeat(80));
  console.log(`📅 ${date} (${dayOfWeek}요일) 상세 기록`);
  console.log("═".repeat(80));

  for (const entry of log.entries) {
    const status = entry.status === "success" ? "✅" : "❌";
    console.log(`\n${status} ${entry.time}`);
    console.log(`   📝 MR !${entry.mrIid}: ${entry.mrTitle}`);
    console.log(`   🔗 ${entry.mrUrl}`);
    console.log(`   🤖 ${entry.provider}/${entry.model}`);
    console.log(`   📊 프롬프트: ${entry.tokenUsage.promptTokens.toLocaleString()} | 응답: ${entry.tokenUsage.completionTokens.toLocaleString()} | 총: ${entry.tokenUsage.totalTokens.toLocaleString()} tokens`);
    console.log(`   💰 예상 비용: $${entry.estimatedCostUSD.toFixed(4)} (₩${entry.estimatedCostKRW.toLocaleString()})`);
    if (entry.diffInfo) {
      console.log(`   📁 파일: ${entry.diffInfo.fileCount}개 | ${(entry.diffInfo.totalSizeBytes / 1024).toFixed(1)}KB`);
    }
    if (entry.errorMessage) {
      console.log(`   ⚠️ 에러: ${entry.errorMessage}`);
    }
  }

  const totalTokens = log.entries.reduce((sum, e) => sum + e.tokenUsage.totalTokens, 0);
  const totalCostKRW = log.entries.reduce((sum, e) => sum + e.estimatedCostKRW, 0);

  console.log("\n" + "═".repeat(80));
  console.log(`📊 ${date} 요약: ${log.entries.length}건, ${totalTokens.toLocaleString()} tokens, ₩${totalCostKRW.toLocaleString()}`);
  console.log("═".repeat(80) + "\n");
};

const printFileStructure = () => {
  const { readdirSync, existsSync } = require("fs");
  const logDir = join(process.cwd(), "data", "log");

  console.log("\n📁 로그 파일 구조\n");
  console.log("data/log/");
  
  // all-entries.json
  const allEntriesPath = join(logDir, "all-entries.json");
  if (existsSync(allEntriesPath)) {
    const log = loadUsageLog();
    console.log(`├── all-entries.json (${log.entries.length}건)`);
  }

  // monthly
  const monthlyDir = join(logDir, "monthly");
  if (existsSync(monthlyDir)) {
    const monthlyFiles = readdirSync(monthlyDir).filter((f: string) => f.endsWith(".json")).sort().reverse();
    console.log("├── monthly/");
    for (const file of monthlyFiles) {
      const log = loadMonthlyLog(file.replace(".json", ""));
      console.log(`│   └── ${file} (${log.entries.length}건)`);
    }
  }

  // daily
  const dailyDir = join(logDir, "daily");
  if (existsSync(dailyDir)) {
    const dailyFiles = readdirSync(dailyDir).filter((f: string) => f.endsWith(".json")).sort().reverse().slice(0, 10);
    console.log("└── daily/");
    for (const file of dailyFiles) {
      const log = loadDailyLog(file.replace(".json", ""));
      console.log(`    └── ${file} (${log.entries.length}건)`);
    }
    const totalDailyFiles = readdirSync(dailyDir).filter((f: string) => f.endsWith(".json")).length;
    if (totalDailyFiles > 10) {
      console.log(`    ... 외 ${totalDailyFiles - 10}개 파일`);
    }
  }

  console.log("");
};

// 인자 파싱 및 실행
const run = () => {
  if (args.length === 0) {
    printMonthlyStatistics();
    return;
  }

  const firstArg = args[0];

  // 도움말
  if (firstArg === "--help" || firstArg === "-h") {
    printHelp();
    return;
  }

  // 일별 상세 포함
  if (firstArg === "--daily" || firstArg === "-d") {
    printMonthlyStatistics(undefined, true);
    return;
  }

  // 특정 일 (YYYY-MM-DD 형식)
  if (/^\d{4}-\d{2}-\d{2}$/.test(firstArg)) {
    printDailyDetail(firstArg);
    return;
  }

  // 특정 월 (YYYY-MM 형식)
  if (/^\d{4}-\d{2}$/.test(firstArg)) {
    printMonthlyDetail(firstArg);
    return;
  }

  // 최근 N개
  if (firstArg === "--recent" || firstArg === "-r") {
    const count = parseInt(args[1] || "10", 10);
    printRecentEntries(count);
    return;
  }

  // CSV 내보내기
  if (firstArg === "--export" || firstArg === "-e") {
    exportCSV();
    return;
  }

  // JSON 출력
  if (firstArg === "--json" || firstArg === "-j") {
    printJSON();
    return;
  }

  // 파일 구조 보기
  if (firstArg === "--files" || firstArg === "-f") {
    printFileStructure();
    return;
  }

  // 알 수 없는 옵션
  console.log(`\n❌ 알 수 없는 옵션: ${firstArg}`);
  printHelp();
};

run();
