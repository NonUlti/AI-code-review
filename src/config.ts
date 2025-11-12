import dotenv from "dotenv";

dotenv.config();

interface Config {
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
  scheduler: {
    intervalSeconds: number;
  };
  labels: {
    aiReview: string;
  };
}

const getEnvVariable = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;

  if (!value) {
    throw new Error(`환경 변수 ${key}가 설정되지 않았습니다.`);
  }

  return value;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];

  if (!value) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(`환경 변수 ${key}는 숫자여야 합니다.`);
  }

  return parsed;
};

export const config: Config = {
  gitlab: {
    url: getEnvVariable("GITLAB_URL", "https://gitlab.com"),
    token: getEnvVariable("GITLAB_TOKEN"),
    projectId: getEnvVariable("GITLAB_PROJECT_ID"),
  },
  ollama: {
    url: getEnvVariable("OLLAMA_URL", "http://localhost:11434"),
    model: getEnvVariable("OLLAMA_MODEL", "ai-review-model"),
    timeoutSeconds: getEnvNumber("OLLAMA_TIMEOUT_SECONDS", 600),
  },
  scheduler: {
    intervalSeconds: getEnvNumber("CHECK_INTERVAL_SECONDS", 10),
  },
  labels: {
    aiReview: getEnvVariable("AI_REVIEW_LABEL", "ai-review"),
  },
};

export const validateConfig = (): void => {
  console.log("✓ 설정 검증 완료:");
  console.log(`  - GitLab URL: ${config.gitlab.url}`);
  console.log(`  - GitLab Project ID: ${config.gitlab.projectId}`);
  console.log(`  - Ollama URL: ${config.ollama.url}`);
  console.log(`  - Ollama Model: ${config.ollama.model}`);
  console.log(`  - Ollama Timeout: ${config.ollama.timeoutSeconds}초`);
  console.log(`  - Check Interval: ${config.scheduler.intervalSeconds}초`);
  console.log(`  - AI Review Label: ${config.labels.aiReview}`);
};
