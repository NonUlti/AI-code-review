import { spawn } from "child_process";
import type { CodexDependencies } from "../types/dependencies.js";

/**
 * Codex CLI 의존성을 생성합니다.
 */
export const createCodexDependencies = (cliPath: string, timeoutSeconds: number): CodexDependencies => ({
  cliPath,
  timeoutSeconds,
});

/**
 * Codex CLI를 사용하여 스트리밍 모드로 모델에 질의합니다.
 */
export const queryCodexModelStream = async (
  deps: CodexDependencies,
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<string> => {
  try {
    console.log(`🤖 Codex CLI에 질의 중... (타임아웃: ${deps.timeoutSeconds}초)`);
    console.log(`  CLI 경로: ${deps.cliPath}`);

    return new Promise<string>((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      // Codex CLI exec 명령어로 non-interactive 모드 실행
      // "-" 인자는 stdin에서 프롬프트를 읽는다는 의미
      const codexProcess = spawn(deps.cliPath, ["exec", "-"], {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });

      // 타임아웃 설정
      const timeout = setTimeout(() => {
        codexProcess.kill();
        reject(new Error(`Codex CLI 실행 타임아웃 (${deps.timeoutSeconds}초 초과)`));
      }, deps.timeoutSeconds * 1000);

      // stdin으로 프롬프트 전달
      if (codexProcess.stdin) {
        codexProcess.stdin.write(prompt, "utf-8");
        codexProcess.stdin.end();
      }

      // stdout 데이터 수집
      if (codexProcess.stdout) {
        codexProcess.stdout.setEncoding("utf-8");
        codexProcess.stdout.on("data", (chunk: string) => {
          stdout += chunk;
          onChunk(chunk);
        });
      }

      // stderr 데이터 수집
      if (codexProcess.stderr) {
        codexProcess.stderr.setEncoding("utf-8");
        codexProcess.stderr.on("data", (chunk: string) => {
          stderr += chunk;
        });
      }

      // 프로세스 종료 처리
      codexProcess.on("close", (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          const errorMessage = stderr || `프로세스가 종료 코드 ${code}로 종료되었습니다.`;
          console.error("  Codex CLI 오류:", errorMessage);
          
          if (errorMessage.includes("ENOENT") || errorMessage.includes("not found")) {
            reject(new Error(`Codex CLI를 찾을 수 없습니다: ${deps.cliPath}. PATH에 있는지 확인하거나 절대 경로를 사용하세요.`));
            return;
          }
          
          reject(new Error(`Codex CLI 실행 실패: ${errorMessage}`));
          return;
        }

        if (!stdout || stdout.trim().length === 0) {
          reject(new Error("Codex CLI가 빈 응답을 반환했습니다."));
          return;
        }

        console.log("✓ Codex CLI 응답 수신 완료");
        resolve(stdout.trim());
      });

      // 프로세스 오류 처리
      codexProcess.on("error", (error) => {
        clearTimeout(timeout);
        console.error("  Codex CLI 오류:", error.message);
        
        if (error.message.includes("ENOENT") || error.message.includes("not found")) {
          reject(new Error(`Codex CLI를 찾을 수 없습니다: ${deps.cliPath}. PATH에 있는지 확인하거나 절대 경로를 사용하세요.`));
          return;
        }
        
        reject(new Error(`Codex CLI 실행 실패: ${error.message}`));
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`예상치 못한 오류: ${String(error)}`);
  }
};

/**
 * Codex CLI가 사용 가능한지 확인합니다.
 */
export const checkModelAvailability = async (deps: CodexDependencies): Promise<boolean> => {
  try {
    console.log(`\n🔍 Codex CLI 가용성 확인 중...`);
    console.log(`  CLI 경로: ${deps.cliPath}`);

    return new Promise<boolean>((resolve) => {
      // --version 명령어로 CLI 존재 여부 확인
      const testProcess = spawn(deps.cliPath, ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      });

      const timeout = setTimeout(() => {
        testProcess.kill();
        console.error(`❌ Codex CLI 응답 타임아웃: ${deps.cliPath}`);
        resolve(false);
      }, 5000);

      testProcess.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0 || code === null) {
          console.log(`✓ Codex CLI 사용 가능`);
          resolve(true);
        } else {
          console.error(`❌ Codex CLI를 찾을 수 없습니다: ${deps.cliPath}`);
          console.error(`  팁: CLI 경로가 올바른지 확인하거나 PATH에 있는지 확인하세요.`);
          resolve(false);
        }
      });

      testProcess.on("error", () => {
        clearTimeout(timeout);
        console.error(`❌ Codex CLI를 찾을 수 없습니다: ${deps.cliPath}`);
        console.error(`  팁: CLI 경로가 올바른지 확인하거나 PATH에 있는지 확인하세요.`);
        resolve(false);
      });
    });
  } catch (error) {
    console.error(`❌ Codex CLI를 찾을 수 없습니다: ${deps.cliPath}`);
    console.error(`  오류:`, error instanceof Error ? error.message : error);
    console.error(`  팁: CLI 경로가 올바른지 확인하거나 PATH에 있는지 확인하세요.`);
    return false;
  }
};

