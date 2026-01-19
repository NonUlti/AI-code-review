import dotenv from "dotenv";
import { LLM_PROVIDERS, type LLMProvider } from "./constants/llm-providers.js";
import {
  CODEX_CLI_PATH,
  CODEX_TIMEOUT_SECONDS,
  OLLAMA_TIMEOUT_SECONDS,
  CHECK_INTERVAL_SECONDS,
  AI_REVIEW_LABEL,
} from "./constants/defaults.js";

dotenv.config();

interface Config {
  llm: {
    provider: LLMProvider;
  };
  gitlab: {
    url: string;
    token: string;
    projectId: string;
  };
  ollama: {
    url: string;
    model: string;
    timeoutSeconds: number;
  };
  openai: {
    apiKey: string;
    baseURL?: string;
    model: string;
  };
  codex: {
    cliPath: string;
    timeoutSeconds: number;
  };
}

const getEnvVariable = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;

  if (!value) {
    throw new Error(`환경 변수 ${key}가 설정되지 않았습니다.`);
  }

  return value;
};


const getLLMProvider = (): LLMProvider => {
  const provider = process.env.LLM_PROVIDER || LLM_PROVIDERS.OLLAMA;
  
  if (provider !== LLM_PROVIDERS.OLLAMA && provider !== LLM_PROVIDERS.OPENAI && provider !== LLM_PROVIDERS.CODEX) {
    throw new Error(`지원하지 않는 LLM Provider: ${provider}. "${LLM_PROVIDERS.OLLAMA}", "${LLM_PROVIDERS.OPENAI}", 또는 "${LLM_PROVIDERS.CODEX}"만 사용 가능합니다.`);
  }
  
  return provider as LLMProvider;
};


// Provider를 먼저 결정
const llmProvider = getLLMProvider();

export const config: Config = {
  llm: {
    provider: llmProvider,
  },
  gitlab: {
    url: getEnvVariable("GITLAB_URL", "https://gitlab.com"),
    token: getEnvVariable("GITLAB_TOKEN"),
    projectId: getEnvVariable("GITLAB_PROJECT_ID"),
  },
  ollama: {
    url: llmProvider === LLM_PROVIDERS.OLLAMA 
      ? getEnvVariable("OLLAMA_URL", "http://localhost:11434")
      : "http://localhost:11434",
    model: llmProvider === LLM_PROVIDERS.OLLAMA
      ? getEnvVariable("OLLAMA_MODEL", "ai-review-model")
      : "ai-review-model",
    timeoutSeconds: OLLAMA_TIMEOUT_SECONDS,
  },
  openai: {
    apiKey: llmProvider === LLM_PROVIDERS.OPENAI
      ? getEnvVariable("OPENAI_API_KEY")
      : "",
    baseURL: llmProvider === LLM_PROVIDERS.OPENAI
      ? process.env.OPENAI_BASE_URL
      : undefined,
    model: llmProvider === LLM_PROVIDERS.OPENAI
      ? getEnvVariable("OPENAI_MODEL", "gpt-4")
      : "gpt-4",
  },
  codex: {
    cliPath: CODEX_CLI_PATH,
    timeoutSeconds: CODEX_TIMEOUT_SECONDS,
  },
};

export const validateConfig = (): void => {
  console.log("✓ 설정 검증 완료:");
  console.log(`  - LLM Provider: ${config.llm.provider}`);
  console.log(`  - GitLab URL: ${config.gitlab.url}`);
  console.log(`  - GitLab Project ID: ${config.gitlab.projectId}`);
  
  if (config.llm.provider === LLM_PROVIDERS.OLLAMA) {
    console.log(`  - Ollama URL: ${config.ollama.url}`);
    console.log(`  - Ollama Model: ${config.ollama.model}`);
    console.log(`  - Ollama Timeout: ${config.ollama.timeoutSeconds}초`);
  } else if (config.llm.provider === LLM_PROVIDERS.OPENAI) {
    console.log(`  - OpenAI Model: ${config.openai.model}`);
    if (config.openai.baseURL) {
      console.log(`  - OpenAI Base URL: ${config.openai.baseURL}`);
    }
  } else if (config.llm.provider === LLM_PROVIDERS.CODEX) {
    console.log(`  - Codex CLI Path: ${config.codex.cliPath}`);
    console.log(`  - Codex Timeout: ${config.codex.timeoutSeconds}초`);
  }
  
  console.log(`  - Check Interval: ${CHECK_INTERVAL_SECONDS}초`);
  console.log(`  - AI Review Label: ${AI_REVIEW_LABEL}`);
};
