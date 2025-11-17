import type { Gitlab } from "@gitbeaker/node";
import type { Ollama } from "ollama";
import type OpenAI from "openai";

export interface GitLabDependencies {
  client: InstanceType<typeof Gitlab>;
}

export interface OllamaDependencies {
  client: Ollama;
}

export interface OpenAIDependencies {
  client: OpenAI;
}

export interface CodexDependencies {
  cliPath: string;
  timeoutSeconds: number;
}
