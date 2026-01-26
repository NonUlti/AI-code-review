import type { GitLabDependencies, OllamaDependencies, OpenAIDependencies, CodexDependencies } from "../types/dependencies.js";
import type { MergeRequest } from "../types/gitlab.js";
import type { LLMProvider } from "../types/llm.js";
import { LLM_PROVIDERS } from "../constants/llm-providers.js";
import { EXCLUDE_TARGET_BRANCHES, EXCLUDE_TARGET_BRANCH_PATTERNS } from "../constants/branch-filters.js";
import * as gitlabClient from "./gitlab-client.js";
import * as ollamaClient from "./ollama-client.js";
import * as openaiClient from "./openai-client.js";
import * as codexClient from "./codex-client.js";
import { buildReviewPrompt } from "../utils/prompt-builder.js";
import { calculateTokenUsage } from "../utils/token-counter.js";
import { addUsageEntry } from "../utils/usage-logger.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * 시스템 프롬프트를 로드합니다.
 * AGENTS_FILE 환경 변수로 파일 경로 지정 가능 (기본값: AGENTS.md)
 */
const loadSystemPrompt = (agentsFile = process.env.AGENTS_FILE || "AGENTS.md"): string | undefined => {
  const agentsPath = join(process.cwd(), agentsFile);
  
  if (existsSync(agentsPath)) {
    try {
      console.log(`📜 프롬프트 파일 로드: ${agentsFile}`);
      return readFileSync(agentsPath, "utf-8");
    } catch {
      console.warn(`⚠️ 프롬프트 파일 읽기 실패: ${agentsFile}`);
      return undefined;
    }
  }
  console.warn(`⚠️ 프롬프트 파일 없음: ${agentsFile}`);
  return undefined;
};

/**
 * LLM 클라이언트 타입 (Ollama, OpenAI, 또는 Codex)
 */
export type LLMDependencies = OllamaDependencies | OpenAIDependencies | CodexDependencies;

/**
 * 처리 중인 MR을 추적하기 위한 상태
 */
export interface ProcessingState {
  processing: Set<number>;
}

/**
 * 처리 상태를 생성합니다.
 */
export const createProcessingState = (): ProcessingState => ({
  processing: new Set(),
});

/**
 * 처리 중 발생한 오류를 처리합니다.
 */
const handleProcessingError = async (gitlabDeps: GitLabDependencies, projectId: string, mrIid: number, error: Error): Promise<void> => {
  try {
    const errorComment = `## ⚠️ AI 리뷰 실패

AI 리뷰 중 오류가 발생했습니다:

\`\`\`
${error.message}
\`\`\`

나중에 다시 리뷰 받기를 원할 시 ai-review 라벨을 제거해주세요.`;

    await gitlabClient.addComment(gitlabDeps, projectId, mrIid, errorComment);
  } catch (commentError) {
    console.error("오류 코멘트 추가 실패:", commentError);
  }
};

/**
 * 단일 MR을 처리합니다.
 */
export const processSingleMR = async (
  gitlabDeps: GitLabDependencies,
  llmDeps: LLMDependencies,
  llmProvider: LLMProvider,
  projectId: string,
  aiReviewLabel: string,
  llmModel: string,
  mr: MergeRequest,
  state: ProcessingState
): Promise<void> => {
  state.processing.add(mr.iid);

  // MR URL 사용 (GitLab API에서 제공)
  const mrUrl = mr.web_url;
  let diffInfo: { fileCount: number; totalSizeBytes: number; totalLines: number } | undefined;
  let prompt = "";
  let review = "";

  try {
    console.log(`\n📝 MR !${mr.iid} 처리 시작: ${mr.title}`);

    const changes = await gitlabClient.getMergeRequestChanges(gitlabDeps, projectId, mr.iid);

    if (changes.length === 0) {
      console.log(`⏭️  MR !${mr.iid}에 변경사항이 없습니다. 건너뜁니다.`);
      return;
    }

    console.log(`✓ ${changes.length}개의 파일 변경 발견`);

    // diff 크기 로깅
    const totalDiffSize = changes.reduce((sum, c) => sum + c.diff.length, 0);
    const totalLines = changes.reduce((sum, c) => sum + c.diff.split('\n').length, 0);
    const sizeInKB = (totalDiffSize / 1024).toFixed(1);
    console.log(`📊 전체 diff 크기: ${sizeInKB}KB`);

    // diff 정보 저장 (로깅용)
    diffInfo = {
      fileCount: changes.length,
      totalSizeBytes: totalDiffSize,
      totalLines,
    };

    // 시스템 프롬프트 로드 (AGENTS.md)
    const agentsFile = process.env.AGENTS_FILE || "AGENTS.md";
    const systemPrompt = loadSystemPrompt(agentsFile);
    const promptResult = buildReviewPrompt(mr, changes, systemPrompt);
    prompt = promptResult.prompt;
    const { diffSize, overheadSize } = promptResult;

    // 프롬프트 구성 분석 로깅
    const totalPromptSize = diffSize.characters + overheadSize.characters;
    const diffRatio = ((diffSize.characters / totalPromptSize) * 100).toFixed(1);
    console.log(`📋 프롬프트 구성:`);
    console.log(`  📄 순수 diff: ${diffSize.characters.toLocaleString()}자 (${diffSize.lines}줄) - ${diffRatio}%`);
    console.log(`  📝 오버헤드 합계: ${overheadSize.characters.toLocaleString()}자 (${overheadSize.lines}줄) - ${(100 - parseFloat(diffRatio)).toFixed(1)}%`);
    console.log(`     └─ 시스템 프롬프트 (${agentsFile}): ${overheadSize.breakdown.systemPrompt.characters.toLocaleString()}자 (${overheadSize.breakdown.systemPrompt.lines}줄)`);
    console.log(`     └─ MR 헤더: ${overheadSize.breakdown.mrHeader.characters.toLocaleString()}자 (${overheadSize.breakdown.mrHeader.lines}줄)`);

    console.log(`🔄 스트리밍 모드로 AI 리뷰 요청 중...`);
    
    if (llmProvider === LLM_PROVIDERS.OLLAMA) {
      review = await ollamaClient.queryOllamaModelStream(
        llmDeps as OllamaDependencies,
        llmModel,
        prompt,
        () => {} // 청크는 무시하고 전체 응답만 수집
      );
    } else if (llmProvider === LLM_PROVIDERS.OPENAI) {
      review = await openaiClient.queryOpenAIModelStream(
        llmDeps as OpenAIDependencies,
        llmModel,
        prompt,
        () => {} // 청크는 무시하고 전체 응답만 수집
      );
    } else {
      review = await codexClient.queryCodexModelStream(
        llmDeps as CodexDependencies,
        prompt,
        () => {} // 청크는 무시하고 전체 응답만 수집
      );
    }

    await gitlabClient.addComment(gitlabDeps, projectId, mr.iid, review);

    // 토큰 사용량 계산 및 로깅
    const tokenUsage = calculateTokenUsage(prompt, review, llmModel);
    const logEntry = addUsageEntry({
      mrTitle: mr.title,
      mrUrl,
      projectId,
      mrIid: mr.iid,
      model: llmModel,
      provider: llmProvider,
      tokenUsage,
      status: "success",
      diffInfo,
    });

    console.log(`💰 예상 비용: $${logEntry.estimatedCostUSD.toFixed(4)} (₩${logEntry.estimatedCostKRW.toLocaleString()})`);
    console.log(`✅ MR !${mr.iid} 처리 완료\n`);
  } catch (error) {
    console.error(`❌ MR !${mr.iid} 처리 실패:`, error);

    // 실패 시에도 사용량 기록 (토큰 추정치)
    if (prompt) {
      const errorTokenUsage = calculateTokenUsage(prompt, "", llmModel);
      addUsageEntry({
        mrTitle: mr.title,
        mrUrl,
        projectId,
        mrIid: mr.iid,
        model: llmModel,
        provider: llmProvider,
        tokenUsage: errorTokenUsage,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        diffInfo,
      });
    }

    if (error instanceof Error) {
      await handleProcessingError(gitlabDeps, projectId, mr.iid, error);
    }
  } finally {
    try {
      await gitlabClient.addAiReviewLabel(gitlabDeps, projectId, mr.iid, aiReviewLabel);
    } catch (labelError) {
      console.error(`라벨 추가 실패:`, labelError);
    }
    state.processing.delete(mr.iid);
  }
};

/**
 * 대상 MR들을 찾아서 처리합니다.
 */
export const processMergeRequests = async (
  gitlabDeps: GitLabDependencies,
  llmDeps: LLMDependencies,
  llmProvider: LLMProvider,
  projectId: string,
  aiReviewLabel: string,
  excludeTargetBranches: string[],
  excludeTargetBranchPatterns: string[],
  llmModel: string,
  state: ProcessingState
): Promise<void> => {
  try {
    console.log("\n🔍 AI 리뷰 대상 MR 검색 중...");

    const targetMRs = await gitlabClient.getTargetMergeRequests(
      gitlabDeps,
      projectId,
      aiReviewLabel,
      excludeTargetBranches,
      excludeTargetBranchPatterns
    );

    if (targetMRs.length === 0) {
      console.log("ℹ️  처리할 MR이 없습니다.");
      return;
    }

    console.log(`✓ ${targetMRs.length}개의 MR 발견`);

    for (const mr of targetMRs) {
      if (state.processing.has(mr.iid)) {
        console.log(`⏭️  MR !${mr.iid}는 이미 처리 중입니다. 건너뜁니다.`);
        continue;
      }

      await processSingleMR(gitlabDeps, llmDeps, llmProvider, projectId, aiReviewLabel, llmModel, mr, state);
    }
  } catch (error) {
    console.error("MR 처리 중 오류 발생:", error);
  }
};

/**
 * LLM 모델이 사용 가능한지 확인합니다.
 */
export const checkLLMAvailability = async (
  llmDeps: LLMDependencies,
  llmProvider: LLMProvider,
  model: string
): Promise<boolean> => {
  if (llmProvider === LLM_PROVIDERS.OLLAMA) {
    return ollamaClient.checkModelAvailability(llmDeps as OllamaDependencies, model);
  } else if (llmProvider === LLM_PROVIDERS.OPENAI) {
    return openaiClient.checkModelAvailability(llmDeps as OpenAIDependencies, model);
  } else {
    return codexClient.checkModelAvailability(llmDeps as CodexDependencies);
  }
};

/**
 * Webhook에서 MR ID로 직접 처리를 요청합니다.
 */
export const processMergeRequestById = async (
  gitlabDeps: GitLabDependencies,
  llmDeps: LLMDependencies,
  llmProvider: LLMProvider,
  projectId: string,
  aiReviewLabel: string,
  llmModel: string,
  mrIid: number,
  state: ProcessingState
): Promise<{ success: boolean; message: string }> => {
  // 이미 처리 중인지 확인
  if (state.processing.has(mrIid)) {
    return { success: false, message: `MR !${mrIid}는 이미 처리 중입니다.` };
  }

  // MR 조회
  const mr = await gitlabClient.getMergeRequestById(gitlabDeps, projectId, mrIid);

  if (!mr) {
    return { success: false, message: `MR !${mrIid}를 찾을 수 없습니다.` };
  }

  // MR 상태 확인
  if (mr.state !== "opened") {
    return { success: false, message: `MR !${mrIid}는 열린 상태가 아닙니다. (현재: ${mr.state})` };
  }

  // 리뷰 대상인지 확인
  const targetCheck = gitlabClient.isReviewTarget(
    mr,
    aiReviewLabel,
    EXCLUDE_TARGET_BRANCHES,
    EXCLUDE_TARGET_BRANCH_PATTERNS
  );

  if (!targetCheck.isTarget) {
    return { success: false, message: `MR !${mrIid}는 리뷰 대상이 아닙니다. (${targetCheck.reason})` };
  }

  // 처리 시작
  await processSingleMR(gitlabDeps, llmDeps, llmProvider, projectId, aiReviewLabel, llmModel, mr, state);

  return { success: true, message: `MR !${mrIid} 처리 완료` };
};
