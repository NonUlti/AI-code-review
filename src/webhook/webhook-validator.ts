import type { FastifyRequest } from "fastify";
import type { WebhookPayload, MergeRequestWebhookPayload } from "../types/webhook.js";

/**
 * Webhook Secret 토큰 검증
 */
export const verifyWebhookSecret = (request: FastifyRequest, expectedSecret: string): boolean => {
  const token = request.headers["x-gitlab-token"];

  if (!token) {
    return false;
  }

  return token === expectedSecret;
};

/**
 * Webhook 페이로드 기본 검증
 */
export const validateWebhookPayload = (payload: unknown): payload is WebhookPayload => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const p = payload as Record<string, unknown>;

  // 필수 필드 확인
  if (typeof p.object_kind !== "string") {
    return false;
  }

  if (!p.project || typeof p.project !== "object") {
    return false;
  }

  return true;
};

/**
 * Merge Request Webhook 페이로드 검증
 */
export const validateMergeRequestPayload = (payload: WebhookPayload): payload is MergeRequestWebhookPayload => {
  if (payload.object_kind !== "merge_request") {
    return false;
  }

  const mrPayload = payload as MergeRequestWebhookPayload;

  if (!mrPayload.object_attributes) {
    return false;
  }

  const attrs = mrPayload.object_attributes;

  // 필수 MR 속성 확인
  if (typeof attrs.iid !== "number") {
    return false;
  }

  if (typeof attrs.action !== "string") {
    return false;
  }

  if (typeof attrs.state !== "string") {
    return false;
  }

  return true;
};

/**
 * 검증 에러 메시지 생성
 */
export const getValidationError = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return "Invalid payload: expected object";
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.object_kind !== "string") {
    return "Missing or invalid field: object_kind";
  }

  if (!p.project) {
    return "Missing field: project";
  }

  if (p.object_kind === "merge_request") {
    if (!p.object_attributes) {
      return "Missing field: object_attributes";
    }

    const attrs = p.object_attributes as Record<string, unknown>;

    if (typeof attrs.iid !== "number") {
      return "Missing or invalid field: object_attributes.iid";
    }

    if (typeof attrs.action !== "string") {
      return "Missing or invalid field: object_attributes.action";
    }
  }

  return null;
};
