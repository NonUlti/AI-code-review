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
 * @param mr MR 정보
 * @param changes 변경사항 목록
 * @param systemPrompt 시스템 프롬프트 (AGENTS.md 내용 등)
 * @returns prompt: 전체 프롬프트, diffSize: 순수 diff 크기 정보, overheadSize: 오버헤드 크기
 */
export const buildReviewPrompt = (
  mr: MergeRequest,
  changes: MergeRequestChange[],
  systemPrompt?: string
): {
  prompt: string;
  diffSize: {
    characters: number;
    lines: number;
  };
  overheadSize: {
    characters: number;
    lines: number;
    breakdown: {
      systemPrompt: { characters: number; lines: number };
      mrHeader: { characters: number; lines: number };
    };
  };
} => {
  const formattedChanges = formatChanges(changes);

  // MR 메타 정보 (오버헤드)
  const mrHeader = `# Merge Request 정보
- 제목: ${mr.title}
- 설명: ${mr.description || "설명 없음"}
- URL: ${mr.web_url}

# 코드 변경사항
`;

  const prompt = `${systemPrompt ? `${systemPrompt}\n\n` : ""}${mrHeader}${formattedChanges}`;

  // 순수 diff 크기 (formattedChanges에서 파일 경로/구분선 등도 포함됨)
  const diffCharacters = formattedChanges.length;
  const diffLines = formattedChanges.split('\n').length;

  // MR 헤더 오버헤드
  const mrHeaderCharacters = mrHeader.length;
  const mrHeaderLines = mrHeader.split('\n').length;

  // 시스템 프롬프트 오버헤드 (AGENTS.md 등)
  const systemPromptCharacters = systemPrompt?.length || 0;
  const systemPromptLines = systemPrompt?.split('\n').length || 0;

  // 총 오버헤드
  const totalOverheadCharacters = mrHeaderCharacters + systemPromptCharacters;
  const totalOverheadLines = mrHeaderLines + systemPromptLines;

  return {
    prompt,
    diffSize: {
      characters: diffCharacters,
      lines: diffLines,
    },
    overheadSize: {
      characters: totalOverheadCharacters,
      lines: totalOverheadLines,
      breakdown: {
        systemPrompt: {
          characters: systemPromptCharacters,
          lines: systemPromptLines,
        },
        mrHeader: {
          characters: mrHeaderCharacters,
          lines: mrHeaderLines,
        },
      },
    },
  };
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
