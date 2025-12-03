import type { GitLabDependencies, OllamaDependencies, OpenAIDependencies, CodexDependencies } from "../types/dependencies.js";
import type { MergeRequest } from "../types/gitlab.js";
import type { LLMProvider } from "../types/llm.js";
import { LLM_PROVIDERS } from "../constants/llm-providers.js";
import * as gitlabClient from "./gitlab-client.js";
import * as ollamaClient from "./ollama-client.js";
import * as openaiClient from "./openai-client.js";
import * as codexClient from "./codex-client.js";
import { buildReviewPrompt } from "../utils/prompt-builder.js";

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
    const sizeInKB = (totalDiffSize / 1024).toFixed(1);
    console.log(`📊 전체 diff 크기: ${sizeInKB}KB`);

    const prompt = buildReviewPrompt(mr, changes);

    console.log(`🔄 스트리밍 모드로 AI 리뷰 요청 중...`);
    
    let review: string;
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

    console.log(`✅ MR !${mr.iid} 처리 완료\n`);
  } catch (error) {
    console.error(`❌ MR !${mr.iid} 처리 실패:`, error);

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
  llmModel: string,
  state: ProcessingState
): Promise<void> => {
  try {
    console.log("\n🔍 AI 리뷰 대상 MR 검색 중...");

    const targetMRs = await gitlabClient.getTargetMergeRequests(
      gitlabDeps,
      projectId,
      aiReviewLabel,
      excludeTargetBranches
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
