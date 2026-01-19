/**
 * AI 리뷰에서 제외할 타겟 브랜치 설정
 */

/**
 * 정확히 일치하는 브랜치명으로 제외
 * 예: develop, prod, stage
 */
export const EXCLUDE_TARGET_BRANCHES: string[] = [
  "develop",
  "prod",
  "stage",
];

/**
 * 브랜치명에 포함되어 있으면 제외 (패턴 매칭)
 * 예: "release" → release-1.6.51, release-2.0.0 등 제외
 */
export const EXCLUDE_TARGET_BRANCH_PATTERNS: string[] = [
  "release",
];
