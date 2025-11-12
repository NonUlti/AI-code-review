import { validateConfig, config } from "./config.js";
import * as gitlabClient from "./services/gitlab-client.js";
import * as ollamaClient from "./services/ollama-client.js";
import * as scheduler from "./scheduler.js";

const main = async (): Promise<void> => {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║       GitLab MR AI 리뷰 자동화 도구                        ║");
  console.log("║       Powered by Ollama ai-review-model                ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  try {
    validateConfig();

    // 의존성 생성
    const gitlabDeps = gitlabClient.createGitLabDependencies(config.gitlab.url, config.gitlab.token);

    const ollamaDeps = ollamaClient.createOllamaDependencies(config.ollama.url);

    // 스케줄러 생성
    const schedulerInstance = scheduler.createScheduler(config.scheduler.intervalSeconds);

    // Graceful shutdown 설정
    scheduler.setupGracefulShutdown(schedulerInstance);

    // 스케줄러 시작 (스트리밍 모드는 타임아웃 없음)
    await scheduler.startScheduler(schedulerInstance, gitlabDeps, ollamaDeps, config.gitlab.projectId, config.labels.aiReview, config.ollama.model);
  } catch (error) {
    console.error("\n❌ 프로그램 실행 중 오류 발생:", error);

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exit(1);
  }
};

main();
