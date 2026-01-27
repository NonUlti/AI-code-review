import { validateConfig, config } from "./config.js";
import { LLM_PROVIDERS, LLM_PROVIDER_NAMES } from "./constants/llm-providers.js";
import { CHECK_INTERVAL_SECONDS, AI_REVIEW_LABEL } from "./constants/defaults.js";
import * as gitlabClient from "./services/gitlab-client.js";
import * as ollamaClient from "./services/ollama-client.js";
import * as openaiClient from "./services/openai-client.js";
import * as codexClient from "./services/codex-client.js";
import * as scheduler from "./scheduler.js";
import type { LLMDependencies } from "./services/mr-processor.js";

const main = async (): Promise<void> => {
  const providerName = LLM_PROVIDER_NAMES[config.llm.provider];
  let modelName: string;
  if (config.llm.provider === LLM_PROVIDERS.OLLAMA) {
    modelName = config.ollama.model;
  } else if (config.llm.provider === LLM_PROVIDERS.OPENAI) {
    modelName = config.openai.model;
  } else {
    modelName = "CLI";
  }

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║       GitLab MR AI 리뷰 자동화 도구                        ║");
  console.log(`║       Powered by ${providerName} ${modelName.padEnd(32 - providerName.length)} ║`);
  console.log("╚════════════════════════════════════════════════════════╝\n");

  try {
    validateConfig();

    // GitLab 의존성 생성
    const gitlabDeps = gitlabClient.createGitLabDependencies(config.gitlab.url, config.gitlab.token);

    // LLM 의존성 생성 (provider에 따라)
    let llmDeps: LLMDependencies;
    let llmModel: string;

    if (config.llm.provider === LLM_PROVIDERS.OLLAMA) {
      llmDeps = ollamaClient.createOllamaDependencies(config.ollama.url);
      llmModel = config.ollama.model;
    } else if (config.llm.provider === LLM_PROVIDERS.OPENAI) {
      llmDeps = openaiClient.createOpenAIDependencies(config.openai.apiKey, config.openai.baseURL);
      llmModel = config.openai.model;
    } else {
      llmDeps = codexClient.createCodexDependencies(config.codex.cliPath, config.codex.timeoutSeconds);
      llmModel = "codex-cli";
    }

    // 스케줄러 생성
    const schedulerInstance = scheduler.createScheduler(CHECK_INTERVAL_SECONDS);

    // Graceful shutdown 설정
    scheduler.setupGracefulShutdown(schedulerInstance);

    // 스케줄러 시작
    await scheduler.startScheduler(
      schedulerInstance,
      gitlabDeps,
      llmDeps,
      config.llm.provider,
      config.gitlab.projectId,
      AI_REVIEW_LABEL,
      llmModel
    );
  } catch (error) {
    console.error("\n❌ 프로그램 실행 중 오류 발생:", error);

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exit(1);
  }
};

main();
