import { encoding_for_model, get_encoding, TiktokenModel } from "tiktoken";

/**
 * 토큰 사용량 정보
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  // 입력 크기 정보
  promptCharacters: number;
  promptLines: number;
  // 출력 크기 정보
  completionCharacters: number;
  completionLines: number;
  // 토큰 효율 (비율)
  tokensPerCharacter: number;  // 문자당 토큰 수 (예: 0.25)
  tokensPerLine: number;       // 라인당 토큰 수 (예: 8.5)
  charactersPerToken: number;  // 토큰당 문자 수 (예: 4.0)
}

/**
 * 모델별 인코딩 매핑
 * - cl100k_base: GPT-4, GPT-3.5-turbo, text-embedding-ada-002
 * - o200k_base: GPT-4o, o1, GPT-5 계열 (최신 모델)
 */
const MODEL_ENCODING_MAP: Record<string, string> = {
  // GPT-4 계열
  "gpt-4": "cl100k_base",
  "gpt-4-turbo": "cl100k_base",
  "gpt-4-32k": "cl100k_base",
  // GPT-4o 및 최신 모델 (o200k_base)
  "gpt-4o": "o200k_base",
  "gpt-4o-mini": "o200k_base",
  "o1": "o200k_base",
  "o1-mini": "o200k_base",
  "o1-preview": "o200k_base",
  // GPT-5 계열 (o200k_base 예상)
  "gpt-5": "o200k_base",
  "gpt-5.2": "o200k_base",
  // GPT-3.5 계열
  "gpt-3.5-turbo": "cl100k_base",
};

// 최신 모델용 기본 인코딩 (GPT-4o, GPT-5 계열)
const DEFAULT_ENCODING = "o200k_base";

/**
 * 텍스트의 토큰 수를 계산합니다.
 * @param text 토큰 수를 계산할 텍스트
 * @param model 사용할 모델 (기본: gpt-4o)
 * @returns 토큰 수
 */
export const countTokens = (text: string, model: string = "gpt-4o"): number => {
  try {
    // 먼저 tiktoken에서 직접 모델 지원 여부 확인
    const enc = encoding_for_model(model as TiktokenModel);
    const tokens = enc.encode(text);
    const tokenCount = tokens.length;
    enc.free();
    return tokenCount;
  } catch {
    // 지원하지 않는 모델인 경우 매핑 또는 기본 인코딩 사용
    const encodingName = MODEL_ENCODING_MAP[model.toLowerCase()] || DEFAULT_ENCODING;
    const enc = get_encoding(encodingName as "cl100k_base" | "o200k_base");
    const tokens = enc.encode(text);
    const tokenCount = tokens.length;
    enc.free();
    return tokenCount;
  }
};

/**
 * 프롬프트와 응답의 토큰 사용량을 계산합니다.
 * @param prompt 프롬프트 텍스트
 * @param completion 응답 텍스트
 * @param model 사용할 모델 (기본: gpt-4o)
 * @returns 토큰 사용량 정보
 */
export const calculateTokenUsage = (
  prompt: string,
  completion: string,
  model: string = "gpt-4o"
): TokenUsage => {
  const promptTokens = countTokens(prompt, model);
  const completionTokens = countTokens(completion, model);
  const totalTokens = promptTokens + completionTokens;
  
  // 크기 정보 계산
  const promptCharacters = prompt.length;
  const promptLines = prompt.split('\n').length;
  const completionCharacters = completion.length;
  const completionLines = completion.split('\n').length;
  
  // 전체 문자 수와 라인 수
  const totalCharacters = promptCharacters + completionCharacters;
  const totalLines = promptLines + completionLines;
  
  // 토큰 효율 계산
  const tokensPerCharacter = totalCharacters > 0 ? totalTokens / totalCharacters : 0;
  const tokensPerLine = totalLines > 0 ? totalTokens / totalLines : 0;
  const charactersPerToken = totalTokens > 0 ? totalCharacters / totalTokens : 0;
  
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    promptCharacters,
    promptLines,
    completionCharacters,
    completionLines,
    tokensPerCharacter,
    tokensPerLine,
    charactersPerToken,
  };
};

/**
 * 토큰 사용량을 콘솔에 출력합니다.
 */
export const logTokenUsage = (usage: TokenUsage): void => {
  console.log("\n📊 토큰 사용량:");
  console.log(`  📥 프롬프트: ${usage.promptTokens.toLocaleString()} 토큰 (${usage.promptCharacters.toLocaleString()}자, ${usage.promptLines.toLocaleString()}줄)`);
  console.log(`  📤 응답: ${usage.completionTokens.toLocaleString()} 토큰 (${usage.completionCharacters.toLocaleString()}자, ${usage.completionLines.toLocaleString()}줄)`);
  console.log(`  📈 총합: ${usage.totalTokens.toLocaleString()} 토큰`);
  console.log("\n📐 토큰 효율:");
  console.log(`  🔤 문자당: ${usage.tokensPerCharacter.toFixed(3)} 토큰 (≈ ${usage.charactersPerToken.toFixed(1)}자/토큰)`);
  console.log(`  📝 라인당: ${usage.tokensPerLine.toFixed(1)} 토큰`);
};

/**
 * 예상 비용을 계산합니다 (참고용 - API 가격 기준)
 * 주의: ChatGPT Plus 구독은 토큰 기반 과금이 아니므로 참고용입니다.
 */
export const estimateCost = (usage: TokenUsage, model: string = "gpt-4"): string => {
  // GPT-4 API 기준 가격 (2024년 기준, 참고용)
  const prices: Record<string, { input: number; output: number }> = {
    "gpt-4": { input: 0.03, output: 0.06 }, // per 1K tokens
    "gpt-4-turbo": { input: 0.01, output: 0.03 },
    "gpt-4o": { input: 0.005, output: 0.015 },
    "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  };

  const price = prices[model] || prices["gpt-4"];
  const inputCost = (usage.promptTokens / 1000) * price.input;
  const outputCost = (usage.completionTokens / 1000) * price.output;
  const totalCost = inputCost + outputCost;

  return `$${totalCost.toFixed(4)} (API 사용 시 예상 비용)`;
};
