import type { GitLabDependencies } from "../types/dependencies.js";
import type { LLMProvider } from "../types/llm.js";
import type {
  MergeRequestWebhookPayload,
  WebhookResult,
} from "../types/webhook.js";
import { isProcessableAction } from "../types/webhook.js";
import type { LLMDependencies, ProcessingState } from "../services/mr-processor.js";
import * as mrProcessor from "../services/mr-processor.js";

/**
 * Webhook 핸들러 의존성
 */
export interface WebhookHandlerDeps {
  gitlabDeps: GitLabDependencies;
  llmDeps: LLMDependencies;
  llmProvider: LLMProvider;
  projectId: string;
  aiReviewLabel: string;
  llmModel: string;
  processingState: ProcessingState;
}

/**
 * MR Webhook 이벤트를 처리합니다.
 */
export const handleMergeRequestWebhook = async (
  payload: MergeRequestWebhookPayload,
  deps: WebhookHandlerDeps
): Promise<WebhookResult> => {
  const { object_attributes: attrs } = payload;
  const mrIid = attrs.iid;
  const action = attrs.action;

  console.log(`\n🔔 Webhook 수신: MR !${mrIid} - ${action}`);
  console.log(`   제목: ${attrs.title}`);
  console.log(`   상태: ${attrs.state}`);
  console.log(`   브랜치: ${attrs.source_branch} → ${attrs.target_branch}`);

  // 처리 가능한 액션인지 확인
  if (!isProcessableAction(action)) {
    const message = `액션 '${action}'은 처리 대상이 아닙니다. (대상: open, update, reopen)`;
    console.log(`   ⏭️  ${message}`);
    return { success: true, message, mrIid, action };
  }

  // MR 상태 확인
  if (attrs.state !== "opened") {
    const message = `MR 상태가 '${attrs.state}'입니다. opened 상태만 처리합니다.`;
    console.log(`   ⏭️  ${message}`);
    return { success: true, message, mrIid, action };
  }

  // Draft/WIP 확인
  if (attrs.draft || attrs.work_in_progress) {
    const message = `Draft/WIP MR은 처리하지 않습니다.`;
    console.log(`   ⏭️  ${message}`);
    return { success: true, message, mrIid, action };
  }

  // 프로젝트 ID 확인 (보안)
  const webhookProjectId = String(payload.project.id);
  if (webhookProjectId !== deps.projectId && payload.project.path_with_namespace !== deps.projectId) {
    const message = `프로젝트 ID 불일치: webhook(${webhookProjectId}) != config(${deps.projectId})`;
    console.log(`   ⚠️  ${message}`);
    return { success: false, message, mrIid, action };
  }

  console.log(`   ✓ 처리 시작...`);

  try {
    const result = await mrProcessor.processMergeRequestById(
      deps.gitlabDeps,
      deps.llmDeps,
      deps.llmProvider,
      deps.projectId,
      deps.aiReviewLabel,
      deps.llmModel,
      mrIid,
      deps.processingState
    );

    if (result.success) {
      console.log(`   ✅ ${result.message}`);
    } else {
      console.log(`   ⏭️  ${result.message}`);
    }

    return { success: result.success, message: result.message, mrIid, action };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ 처리 실패: ${message}`);
    return { success: false, message, mrIid, action };
  }
};

/**
 * 지원하지 않는 Webhook 타입을 처리합니다.
 */
export const handleUnsupportedWebhook = (objectKind: string): WebhookResult => {
  const message = `지원하지 않는 Webhook 타입: ${objectKind}`;
  console.log(`\n⏭️  ${message}`);
  return { success: true, message };
};
