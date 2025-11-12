import type { MergeRequest, MergeRequestChange } from "../types/gitlab.js";

/**
 * MR 변경사항을 읽기 쉬운 형식으로 포맷팅합니다.
 */
const formatChanges = (changes: MergeRequestChange[]): string => {
  const formattedChanges = changes.map((change) => {
    let fileStatus = "";

    if (change.new_file) {
      fileStatus = "[NEW]";
    } else if (change.deleted_file) {
      fileStatus = "[DELETED]";
    } else if (change.renamed_file) {
      fileStatus = "[RENAMED]";
    } else {
      fileStatus = "[MODIFIED]";
    }

    const filePath = change.new_path;
    const diff = change.diff;

    return `
${fileStatus} ${filePath}
---
${diff}
---
`;
  });

  return formattedChanges.join("\n");
};

/**
 * MR 정보와 변경사항을 바탕으로 리뷰 요청 프롬프트를 생성합니다.
 */
export const buildReviewPrompt = (mr: MergeRequest, changes: MergeRequestChange[]): string => {
  const formattedChanges = formatChanges(changes);

  const prompt = `# Merge Request 정보
- 제목: ${mr.title}
- 설명: ${mr.description || "설명 없음"}
- URL: ${mr.web_url}

# 코드 변경사항
${formattedChanges}`;

  return prompt;
};

/**
 * 변경사항 요약을 위한 프롬프트를 생성합니다.
 */
export const buildSummaryPrompt = (changes: MergeRequestChange[]): string => {
  const formattedChanges = formatChanges(changes);

  const prompt = `다음 코드 변경사항을 분석하고 요약해주세요:

${formattedChanges}

변경된 내용을 간단히 요약해주세요.`;

  return prompt;
};
