/**
 * GitLab Webhook 페이로드 타입 정의
 */

/**
 * GitLab Webhook 공통 속성
 */
export interface WebhookPayload {
  object_kind: string;
  event_type?: string;
  user: WebhookUser;
  project: WebhookProject;
}

/**
 * Webhook 사용자 정보
 */
export interface WebhookUser {
  id: number;
  name: string;
  username: string;
  email?: string;
  avatar_url?: string;
}

/**
 * Webhook 프로젝트 정보
 */
export interface WebhookProject {
  id: number;
  name: string;
  web_url: string;
  path_with_namespace: string;
}

/**
 * Merge Request Webhook 페이로드
 */
export interface MergeRequestWebhookPayload extends WebhookPayload {
  object_kind: "merge_request";
  object_attributes: MergeRequestAttributes;
  labels?: WebhookLabel[];
  changes?: MergeRequestChanges;
}

/**
 * MR 속성
 */
export interface MergeRequestAttributes {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: "opened" | "closed" | "merged" | "locked";
  action: MergeRequestAction;
  source_branch: string;
  target_branch: string;
  url: string;
  work_in_progress: boolean;
  draft: boolean;
  approved?: boolean;
  detailed_merge_status?: string;
}

/**
 * MR 액션 타입
 */
export type MergeRequestAction =
  | "open"
  | "close"
  | "reopen"
  | "update"
  | "approved"
  | "unapproved"
  | "approval"
  | "unapproval"
  | "merge";

/**
 * MR 변경사항 (어떤 필드가 변경되었는지)
 */
export interface MergeRequestChanges {
  title?: FieldChange<string>;
  description?: FieldChange<string>;
  state?: FieldChange<string>;
  labels?: FieldChange<WebhookLabel[]>;
}

/**
 * 필드 변경 정보
 */
export interface FieldChange<T> {
  previous: T;
  current: T;
}

/**
 * 라벨 정보
 */
export interface WebhookLabel {
  id: number;
  title: string;
  color: string;
  description?: string;
}

/**
 * Webhook 처리 결과
 */
export interface WebhookResult {
  success: boolean;
  message: string;
  mrIid?: number;
  action?: string;
}

/**
 * 처리해야 할 MR 액션 목록
 */
export const PROCESSABLE_ACTIONS: MergeRequestAction[] = ["open", "update", "reopen"];

/**
 * MR Webhook인지 확인
 */
export const isMergeRequestWebhook = (payload: WebhookPayload): payload is MergeRequestWebhookPayload => {
  return payload.object_kind === "merge_request";
};

/**
 * 처리 가능한 액션인지 확인
 */
export const isProcessableAction = (action: MergeRequestAction): boolean => {
  return PROCESSABLE_ACTIONS.includes(action);
};
