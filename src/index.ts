import { validateConfig, config } from "./config.js";
import { LLM_PROVIDERS, LLM_PROVIDER_NAMES } from "./constants/llm-providers.js";
import { AI_REVIEW_LABEL } from "./constants/defaults.js";
import * as gitlabClient from "./services/gitlab-client.js";
import * as ollamaClient from "./services/ollama-client.js";
import * as openaiClient from "./services/openai-client.js";
import * as codexClient from "./services/codex-client.js";
import * as mrProcessor from "./services/mr-processor.js";
import { createServer, startServer, setupGracefulShutdown } from "./server.js";
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
  console.log("║       Mode: Webhook Server                                ║");
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

    // LLM 사용 가능 여부 확인
    console.log(`\n🔍 ${LLM_PROVIDER_NAMES[config.llm.provider]} 모델 확인 중...`);
    const isAvailable = await mrProcessor.checkLLMAvailability(llmDeps, config.llm.provider, llmModel);

    if (!isAvailable) {
      console.error(`❌ ${LLM_PROVIDER_NAMES[config.llm.provider]} 모델을 사용할 수 없습니다. 프로그램을 종료합니다.`);
      process.exit(1);
    }
    console.log(`✓ ${LLM_PROVIDER_NAMES[config.llm.provider]} 모델 사용 가능`);

    // 처리 상태 생성
    const processingState = mrProcessor.createProcessingState();

    // 서버 생성
    const server = createServer(
      {
        port: config.webhook.port,
        host: config.webhook.host,
        webhookSecret: config.webhook.secret,
      },
      {
        gitlabDeps,
        llmDeps,
        llmProvider: config.llm.provider,
        projectId: config.gitlab.projectId,
        aiReviewLabel: AI_REVIEW_LABEL,
        llmModel,
        processingState,
      }
    );

    // Graceful shutdown 설정
    setupGracefulShutdown(server);

    // 서버 시작
    await startServer(server, {
      port: config.webhook.port,
      host: config.webhook.host,
      webhookSecret: config.webhook.secret,
    });

    console.log("\n✓ 서버가 정상적으로 시작되었습니다.");
    console.log("  Ctrl+C를 눌러 종료할 수 있습니다.\n");
  } catch (error) {
    console.error("\n❌ 프로그램 실행 중 오류 발생:", error);

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exit(1);
  }
};

main();
