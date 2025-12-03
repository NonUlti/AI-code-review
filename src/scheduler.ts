import { config } from "./config.js";
import type { GitLabDependencies } from "./types/dependencies.js";
import type { LLMProvider } from "./types/llm.js";
import { LLM_PROVIDER_NAMES } from "./constants/llm-providers.js";
import type { LLMDependencies } from "./services/mr-processor.js";
import * as mrProcessor from "./services/mr-processor.js";

/**
 * 스케줄러 상태
 */
export interface Scheduler {
  isRunning: boolean;
  isProcessing: boolean;
  intervalId?: NodeJS.Timeout;
  intervalSeconds: number;
  processingState: mrProcessor.ProcessingState;
}

/**
 * 스케줄러를 생성합니다.
 */
export const createScheduler = (intervalSeconds: number): Scheduler => ({
  isRunning: false,
  isProcessing: false,
  intervalId: undefined,
  intervalSeconds,
  processingState: mrProcessor.createProcessingState(),
});

/**
 * 한 번 실행합니다.
 */
const runOnce = async (
  scheduler: Scheduler,
  gitlabDeps: GitLabDependencies,
  llmDeps: LLMDependencies,
  llmProvider: LLMProvider,
  projectId: string,
  aiReviewLabel: string,
  llmModel: string
): Promise<void> => {
  if (scheduler.isProcessing) {
    const timestamp = new Date().toLocaleString("ko-KR");
    console.log(`\n⏭️  [${timestamp}] 이전 작업이 아직 처리 중입니다. 이번 체크를 건너뜁니다.`);
    return;
  }

  scheduler.isProcessing = true;
  const timestamp = new Date().toLocaleString("ko-KR");
  console.log(`\n⏰ [${timestamp}] MR 체크 시작`);

  try {
    await mrProcessor.processMergeRequests(
      gitlabDeps,
      llmDeps,
      llmProvider,
      projectId,
      aiReviewLabel,
      config.gitlab.excludeTargetBranches,
      llmModel,
      scheduler.processingState
    );
  } catch (error) {
    console.error("처리 중 오류 발생:", error);
  } finally {
    scheduler.isProcessing = false;
    console.log(`⏰ [${timestamp}] MR 체크 완료`);
  }
};

/**
 * 스케줄러를 시작합니다.
 */
export const startScheduler = async (
  scheduler: Scheduler,
  gitlabDeps: GitLabDependencies,
  llmDeps: LLMDependencies,
  llmProvider: LLMProvider,
  projectId: string,
  aiReviewLabel: string,
  llmModel: string
): Promise<void> => {
  if (scheduler.isRunning) {
    console.log("⚠️  스케줄러가 이미 실행 중입니다.");
    return;
  }

  console.log(`\n🚀 스케줄러 시작 (${scheduler.intervalSeconds}초 간격)`);

  const isAvailable = await mrProcessor.checkLLMAvailability(llmDeps, llmProvider, llmModel);

  if (!isAvailable) {
    console.error(`❌ ${LLM_PROVIDER_NAMES[llmProvider]} 모델을 사용할 수 없습니다. 프로그램을 종료합니다.`);
    process.exit(1);
  }

  scheduler.isRunning = true;

  await runOnce(scheduler, gitlabDeps, llmDeps, llmProvider, projectId, aiReviewLabel, llmModel);

  scheduler.intervalId = setInterval(async () => {
    await runOnce(scheduler, gitlabDeps, llmDeps, llmProvider, projectId, aiReviewLabel, llmModel);
  }, scheduler.intervalSeconds * 1000);

  console.log("✓ 스케줄러가 정상적으로 시작되었습니다.");
  console.log("  Ctrl+C를 눌러 종료할 수 있습니다.\n");
};

/**
 * 스케줄러를 중지합니다.
 */
export const stopScheduler = (scheduler: Scheduler): void => {
  if (!scheduler.isRunning) {
    console.log("⚠️  스케줄러가 실행 중이 아닙니다.");
    return;
  }

  if (scheduler.intervalId) {
    clearInterval(scheduler.intervalId);
    scheduler.intervalId = undefined;
  }

  scheduler.isRunning = false;
  console.log("\n🛑 스케줄러가 중지되었습니다.");
};

/**
 * Graceful shutdown을 처리합니다.
 */
export const setupGracefulShutdown = (scheduler: Scheduler): void => {
  const shutdown = (signal: string) => {
    console.log(`\n${signal} 신호를 받았습니다. 종료 중...`);
    stopScheduler(scheduler);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};
