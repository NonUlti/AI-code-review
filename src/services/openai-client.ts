import OpenAI from "openai";
import type { OpenAIDependencies } from "../types/dependencies.js";

/**
 * OpenAI 의존성을 생성합니다.
 */
export const createOpenAIDependencies = (apiKey: string, baseURL?: string): OpenAIDependencies => {
  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  return { client };
};

/**
 * OpenAI 모델에 스트리밍 모드로 질의합니다.
 */
export const queryOpenAIModelStream = async (
  deps: OpenAIDependencies,
  model: string,
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<string> => {
  try {
    console.log(`🤖 OpenAI 모델 ${model}에 질의 중...`);

    const stream = await deps.client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: true,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }

    console.log("✓ OpenAI 응답 수신 완료");
    return fullResponse;
  } catch (error) {
    if (error instanceof Error) {
      console.error("  OpenAI 오류:", error.message);
      throw new Error(`OpenAI 질의 실패: ${error.message}`);
    }
    throw error;
  }
};

/**
 * OpenAI 모델이 사용 가능한지 확인합니다.
 */
export const checkModelAvailability = async (deps: OpenAIDependencies, model: string): Promise<boolean> => {
  try {
    console.log(`\n🔍 OpenAI 모델 "${model}" 가용성 확인 중...`);

    // 모델 목록을 가져와서 확인
    const models = await deps.client.models.list();
    const availableModels = models.data.map((m) => m.id);

    if (availableModels.includes(model)) {
      console.log(`✓ 모델 "${model}" 사용 가능`);
      return true;
    }

    console.warn(`⚠️  모델 "${model}"을 찾을 수 없습니다.`);
    console.log(`  사용 가능한 모델 목록 (처음 10개):`);
    availableModels.slice(0, 10).forEach((m) => console.log(`    - ${m}`));

    // 모델이 목록에 없어도 사용 가능할 수 있으므로 경고만 하고 true 반환
    return true;
  } catch (error) {
    console.error(`❌ OpenAI 연결 실패:`, error instanceof Error ? error.message : error);
    return false;
  }
};

