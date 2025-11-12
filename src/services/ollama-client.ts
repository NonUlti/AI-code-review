import { Ollama } from "ollama";
import type { OllamaDependencies } from "../types/dependencies.js";

/**
 * Ollama 의존성을 생성합니다.
 */
export const createOllamaDependencies = (url: string): OllamaDependencies => ({
  client: new Ollama({
    host: url,
  }),
});

/**
 * Ollama 모델에 질의하고 응답을 반환합니다.
 */
export const queryOllamaModel = async (deps: OllamaDependencies, model: string, prompt: string, timeoutSeconds: number): Promise<string> => {
  try {
    console.log(`🤖 ${model} 모델에 질의 중... (타임아웃: ${timeoutSeconds}초)`);
    const startTime = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`모델 응답 타임아웃 (${timeoutSeconds}초 초과)`));
      }, timeoutSeconds * 1000);
    });

    const generatePromise = deps.client.generate({
      model: model,
      prompt: prompt,
      stream: false,
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);

    if (!response.response) {
      throw new Error("모델 응답이 비어있습니다.");
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✓ 모델 응답 수신 완료 (${elapsedTime}초 소요)`);
    return response.response;
  } catch (error) {
    console.error("Ollama 모델 질의 실패:", error);
    throw error;
  }
};

/**
 * 스트리밍 방식으로 응답을 받습니다.
 */
export const queryOllamaModelStream = async (deps: OllamaDependencies, model: string, prompt: string, onChunk: (chunk: string) => void): Promise<string> => {
  try {
    console.log(`🤖 ${model} 모델에 스트리밍 질의 중...`);

    let fullResponse = "";

    const stream = await deps.client.generate({
      model: model,
      prompt: prompt,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.response) {
        fullResponse += chunk.response;
        onChunk(chunk.response);
      }
    }

    console.log("✓ 모델 응답 수신 완료");
    return fullResponse;
  } catch (error) {
    console.error("Ollama 스트리밍 질의 실패:", error);
    throw error;
  }
};

/**
 * 모델이 사용 가능한지 확인합니다.
 */
export const checkModelAvailability = async (deps: OllamaDependencies, model: string): Promise<boolean> => {
  try {
    const models = await deps.client.list();
    const isAvailable = models.models.some((m) => m.name === model);

    if (!isAvailable) {
      console.warn(`⚠️  모델 "${model}"을 찾을 수 없습니다.`);
      console.log("사용 가능한 모델 목록:");
      models.models.forEach((m) => {
        console.log(`  - ${m.name}`);
      });
    }

    return isAvailable;
  } catch (error) {
    console.error("모델 확인 실패:", error);
    return false;
  }
};
