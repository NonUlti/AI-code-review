/**
 * LLM Provider 상수
 */
export const LLM_PROVIDERS = {
  OLLAMA: "ollama",
  OPENAI: "openai",
  CODEX: "codex",
} as const;

/**
 * LLM Provider 표시용 이름
 */
export const LLM_PROVIDER_NAMES = {
  [LLM_PROVIDERS.OLLAMA]: "Ollama",
  [LLM_PROVIDERS.OPENAI]: "OpenAI",
  [LLM_PROVIDERS.CODEX]: "Codex CLI",
} as const;

/**
 * LLM Provider 타입
 */
export type LLMProvider = (typeof LLM_PROVIDERS)[keyof typeof LLM_PROVIDERS];

