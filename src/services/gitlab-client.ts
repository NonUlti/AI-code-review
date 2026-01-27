import { Gitlab } from "@gitbeaker/node";
import type { GitLabDependencies } from "../types/dependencies.js";
import type { MergeRequest, MergeRequestChange } from "../types/gitlab.js";

/**
 * GitLab 의존성을 생성합니다.
 */
export const createGitLabDependencies = (url: string, token: string): GitLabDependencies => ({
  client: new Gitlab({
    host: url,
    token: token,
  }),
});

/**
 * MR이 approved 되었는지 확인합니다.
 */
const checkIfApproved = (mr: MergeRequest): boolean => {
  if (mr.approved !== undefined) {
    return mr.approved;
  }

  if (mr.detailed_merge_status === "approved") {
    return true;
  }

  if (mr.merge_status === "can_be_merged" && mr.approvals_before_merge === 0) {
    return true;
  }

  if ((mr as any).approvals?.approved) {
    return true;
  }

  return false;
};

/**
 * 브랜치가 제외 대상인지 확인합니다.
 * - exactMatches: 정확히 일치하는 브랜치명 (예: "develop", "prod")
 * - patterns: 브랜치명에 포함되어 있으면 제외 (예: "release" -> "release-1.6.51" 제외)
 */
const isExcludedTargetBranch = (
  targetBranch: string,
  exactMatches: string[],
  patterns: string[]
): { excluded: boolean; reason?: string } => {
  // 정확한 브랜치명 매칭
  if (exactMatches.includes(targetBranch)) {
    return { excluded: true, reason: `제외 대상 브랜치(${targetBranch})` };
  }

  // 패턴 매칭 (브랜치명에 패턴이 포함되어 있는지)
  for (const pattern of patterns) {
    if (targetBranch.includes(pattern)) {
      return { excluded: true, reason: `제외 패턴 매칭(${pattern} in ${targetBranch})` };
    }
  }

  return { excluded: false };
};

/**
 * AI 리뷰 대상 MR을 조회합니다.
 * 조건: open 상태, ai-review 라벨 없음, approved 안 됨
 */
export const getTargetMergeRequests = async (
  deps: GitLabDependencies,
  projectId: string,
  aiReviewLabel: string,
  excludeTargetBranches: string[],
  excludeTargetBranchPatterns: string[] = []
): Promise<MergeRequest[]> => {
  try {
    console.log(`  프로젝트 ID: ${projectId}로 MR 조회 중...`);

    const allMRs = (await deps.client.MergeRequests.all({
      projectId: projectId,
      state: "opened",
    })) as MergeRequest[];

    console.log(`  총 ${allMRs.length}개의 open MR 발견`);

    const targetMRs: MergeRequest[] = [];

    for (const mr of allMRs) {
      const isApproved = checkIfApproved(mr);
      const hasAiReviewLabel = mr.labels.includes(aiReviewLabel);
      const branchExclusion = isExcludedTargetBranch(
        mr.target_branch,
        excludeTargetBranches,
        excludeTargetBranchPatterns
      );

      if (!hasAiReviewLabel && !isApproved && !branchExclusion.excluded) {
        console.log(`  ✓ MR !${mr.iid}: "${mr.title}" - 리뷰 대상 (approved: ${isApproved}, target: ${mr.target_branch})`);
        targetMRs.push(mr);
      } else {
        let reason = "";
        if (hasAiReviewLabel) {
          reason = "ai-review 라벨 있음";
        } else if (isApproved) {
          reason = "이미 approved됨";
        } else if (branchExclusion.excluded) {
          reason = branchExclusion.reason!;
        }
        console.log(`  ⏭️  MR !${mr.iid}: "${mr.title}" - ${reason} (건너뜀)`);
      }
    }

    console.log(`  → ${targetMRs.length}개의 MR이 리뷰 대상입니다.`);
    return targetMRs;
  } catch (error) {
    const err = error as any;
    console.error("MR 목록 조회 실패:");
    console.error(`  상태 코드: ${err.code || err.statusCode || "unknown"}`);
    console.error(`  메시지: ${err.message || err.description || "unknown"}`);
    console.error(`  프로젝트 ID: ${projectId}`);
    throw error;
  }
};

/**
 * MR의 변경 사항을 조회합니다.
 */
export const getMergeRequestChanges = async (deps: GitLabDependencies, projectId: string, mrIid: number): Promise<MergeRequestChange[]> => {
  try {
    const mr = (await deps.client.MergeRequests.changes(projectId, mrIid)) as any;
    return mr.changes as MergeRequestChange[];
  } catch (error) {
    console.error(`MR ${mrIid} 변경 사항 조회 실패:`, error);
    throw error;
  }
};

/**
 * MR에 코멘트를 추가합니다.
 */
export const addComment = async (deps: GitLabDependencies, projectId: string, mrIid: number, comment: string): Promise<void> => {
  try {
    await deps.client.MergeRequestNotes.create(projectId, mrIid, comment);
    console.log(`✓ MR !${mrIid}에 코멘트 추가 완료`);
  } catch (error) {
    console.error(`MR ${mrIid} 코멘트 추가 실패:`, error);
    throw error;
  }
};

/**
 * MR에 라벨을 추가합니다.
 */
export const addLabel = async (deps: GitLabDependencies, projectId: string, mrIid: number, label: string): Promise<void> => {
  try {
    const mr = (await deps.client.MergeRequests.show(projectId, mrIid)) as MergeRequest;

    const currentLabels = mr.labels || [];
    const newLabels = [...currentLabels, label];

    await deps.client.MergeRequests.edit(projectId, mrIid, {
      labels: newLabels.join(","),
    });
    console.log(`✓ MR !${mrIid}에 라벨 "${label}" 추가 완료`);
  } catch (error) {
    console.error(`MR ${mrIid} 라벨 추가 실패:`, error);
    throw error;
  }
};

/**
 * MR에 AI 리뷰 라벨을 추가합니다.
 */
export const addAiReviewLabel = async (deps: GitLabDependencies, projectId: string, mrIid: number, aiReviewLabel: string): Promise<void> => {
  return addLabel(deps, projectId, mrIid, aiReviewLabel);
};
