import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { GitLabDependencies } from "./types/dependencies.js";
import type { LLMProvider } from "./types/llm.js";
import type { WebhookPayload, MergeRequestWebhookPayload } from "./types/webhook.js";
import { isMergeRequestWebhook } from "./types/webhook.js";
import {
  verifyWebhookSecret,
  validateWebhookPayload,
  validateMergeRequestPayload,
  getValidationError,
} from "./webhook/webhook-validator.js";
import {
  handleMergeRequestWebhook,
  handleUnsupportedWebhook,
  type WebhookHandlerDeps,
} from "./webhook/webhook-handler.js";
import type { LLMDependencies, ProcessingState } from "./services/mr-processor.js";

/**
 * 서버 설정
 */
export interface ServerConfig {
  port: number;
  host: string;
  webhookSecret: string;
}

/**
 * 서버 의존성
 */
export interface ServerDependencies {
  gitlabDeps: GitLabDependencies;
  llmDeps: LLMDependencies;
  llmProvider: LLMProvider;
  projectId: string;
  aiReviewLabel: string;
  llmModel: string;
  processingState: ProcessingState;
}

/**
 * Fastify 서버를 생성합니다.
 */
export const createServer = (
  config: ServerConfig,
  deps: ServerDependencies
): FastifyInstance => {
  const fastify = Fastify({
    logger: false,
  });

  // 헬스 체크 엔드포인트
  fastify.get("/health", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: "ok", timestamp: new Date().toISOString() });
  });

  // GitLab Webhook 엔드포인트
  fastify.post("/webhook/gitlab", async (request: FastifyRequest, reply: FastifyReply) => {
    const timestamp = new Date().toLocaleString("ko-KR");
    console.log(`\n⏰ [${timestamp}] Webhook 요청 수신`);

    // Secret 토큰 검증
    if (config.webhookSecret) {
      if (!verifyWebhookSecret(request, config.webhookSecret)) {
        console.log("   ❌ Webhook Secret 검증 실패");
        return reply.status(401).send({ error: "Unauthorized: Invalid webhook secret" });
      }
      console.log("   ✓ Webhook Secret 검증 성공");
    } else {
      console.log("   ⚠️  Webhook Secret 미설정 (보안 경고!)");
    }

    // 페이로드 검증
    const payload = request.body;
    if (!validateWebhookPayload(payload)) {
      const error = getValidationError(payload);
      console.log(`   ❌ 페이로드 검증 실패: ${error}`);
      return reply.status(400).send({ error: `Invalid payload: ${error}` });
    }

    const webhookPayload = payload as WebhookPayload;

    // Webhook 타입별 처리
    if (isMergeRequestWebhook(webhookPayload)) {
      if (!validateMergeRequestPayload(webhookPayload)) {
        const error = getValidationError(payload);
        console.log(`   ❌ MR 페이로드 검증 실패: ${error}`);
        return reply.status(400).send({ error: `Invalid MR payload: ${error}` });
      }

      const handlerDeps: WebhookHandlerDeps = {
        gitlabDeps: deps.gitlabDeps,
        llmDeps: deps.llmDeps,
        llmProvider: deps.llmProvider,
        projectId: deps.projectId,
        aiReviewLabel: deps.aiReviewLabel,
        llmModel: deps.llmModel,
        processingState: deps.processingState,
      };

      // 비동기로 처리 (즉시 응답 반환)
      const mrPayload = webhookPayload as MergeRequestWebhookPayload;

      // 즉시 202 Accepted 반환 후 백그라운드에서 처리
      setImmediate(async () => {
        try {
          await handleMergeRequestWebhook(mrPayload, handlerDeps);
        } catch (error) {
          console.error("Webhook 처리 중 오류:", error);
        }
      });

      return reply.status(202).send({
        status: "accepted",
        message: `MR !${mrPayload.object_attributes.iid} 처리 시작`,
        mrIid: mrPayload.object_attributes.iid,
        action: mrPayload.object_attributes.action,
      });
    } else {
      const result = handleUnsupportedWebhook(webhookPayload.object_kind);
      return reply.send(result);
    }
  });

  return fastify;
};

/**
 * 서버를 시작합니다.
 */
export const startServer = async (
  fastify: FastifyInstance,
  config: ServerConfig
): Promise<void> => {
  try {
    await fastify.listen({ port: config.port, host: config.host });
    console.log(`\n🌐 Webhook 서버 시작됨`);
    console.log(`   - 주소: http://${config.host}:${config.port}`);
    console.log(`   - Webhook URL: http://<your-domain>:${config.port}/webhook/gitlab`);
    console.log(`   - Health Check: http://${config.host}:${config.port}/health`);
  } catch (error) {
    console.error("서버 시작 실패:", error);
    throw error;
  }
};

/**
 * 서버를 중지합니다.
 */
export const stopServer = async (fastify: FastifyInstance): Promise<void> => {
  try {
    await fastify.close();
    console.log("\n🛑 Webhook 서버가 중지되었습니다.");
  } catch (error) {
    console.error("서버 중지 실패:", error);
    throw error;
  }
};

/**
 * Graceful shutdown을 설정합니다.
 */
export const setupGracefulShutdown = (fastify: FastifyInstance): void => {
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} 신호를 받았습니다. 종료 중...`);
    await stopServer(fastify);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};
