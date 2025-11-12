import type { Gitlab } from "@gitbeaker/node";
import type { Ollama } from "ollama";

export interface GitLabDependencies {
  client: InstanceType<typeof Gitlab>;
}

export interface OllamaDependencies {
  client: Ollama;
}
