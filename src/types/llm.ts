export type { LLMProvider } from "../constants/llm-providers.js";

/**
 * LLM 클라이언트 공통 인터페이스
 */
export interface LLMClientInterface {
  queryStream: (model: string, prompt: string, onChunk: (chunk: string) => void) => Promise<string>;
  checkAvailability: (model: string) => Promise<boolean>;
}

