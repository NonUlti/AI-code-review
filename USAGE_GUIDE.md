# GitLab MR AI 리뷰 자동화 도구 사용 가이드

이 프로젝트는 GitLab Webhook을 통해 Merge Request(MR)를 실시간으로 감지하여 **LLM(Ollama / OpenAI / Codex CLI)** 으로 코드 리뷰를 수행하고, 결과를 **MR 코멘트로 자동 등록**한 뒤 **라벨을 추가**하는 자동화 도구입니다.

> 참고: 이 문서는 **현재 코드 구현**(`src/*`) 기준으로 작성되었습니다.

## 핵심 동작 요약

```
GitLab Webhook → HTTP Server → MR 처리 → AI 리뷰 → 코멘트 작성
```

1. GitLab에서 MR 이벤트(open, update, reopen) 발생 시 Webhook 전송
2. 서버가 Webhook을 수신하고 Secret 토큰 검증
3. 조건을 만족하는 MR에 대해:
   - MR 변경사항(changes) diff를 수집
   - `AGENTS*.md` (시스템 프롬프트) + MR 메타 + diff로 프롬프트 구성
   - 선택한 Provider로 스트리밍 질의
   - MR에 리뷰 코멘트 작성
   - 사용량/비용 로그 저장
   - `ai-review` 라벨을 추가 (성공/실패 모두)

## 사전 준비

### Node.js

- Node.js **18+** 권장 (ESM, `tsx`, 최신 OpenAI SDK 사용)

### GitLab Personal Access Token

- GitLab에서 Personal Access Token 발급 후 아래 scope 권장
  - `api`
  - `read_api`
  - `write_repository` (MR 코멘트 작성에 필요)

### LLM Provider 중 1개 준비

#### Option A) Ollama (로컬)

```bash
brew install ollama
ollama serve
```

사용할 모델 준비:

```bash
ollama pull gpt-oss-20b
ollama create ai-review-model -f Modelfile
ollama list
```

#### Option B) OpenAI (클라우드)

OpenAI API Key 발급 후 환경변수로 설정합니다.

#### Option C) Codex CLI

```bash
npm install -g @openai/codex
codex --version
```

## 설치

```bash
npm install
```

## 설정

### 환경변수 파일

이 프로젝트는 실행 시 `dotenv`로 환경변수 파일을 로드합니다.

- **`ENV_FILE`**: 사용할 `.env` 파일 경로 (기본값: `.env`)
- **`AGENTS_FILE`**: 시스템 프롬프트 파일 경로 (기본값: `AGENTS.md`)
- **`LOG_DIR`**: 로그 디렉토리 분리용 프로젝트 키 (선택)

### `.env` 템플릿

> 실제 토큰/키는 절대 커밋하지 마세요. `.gitignore`가 `.env`, `.env.*`를 무시하도록 설정되어 있습니다.

```env
# ============================================
# Provider 선택: ollama | openai | codex
# ============================================
LLM_PROVIDER=ollama

# ============================================
# GitLab
# ============================================
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=12345678

# ============================================
# Webhook Server
# ============================================
WEBHOOK_PORT=3000
WEBHOOK_HOST=0.0.0.0
WEBHOOK_SECRET=your-secret-token

# ============================================
# Ollama (LLM_PROVIDER=ollama)
# ============================================
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=ai-review-model:latest

# ============================================
# OpenAI (LLM_PROVIDER=openai)
# ============================================
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o
# 선택: 커스텀 엔드포인트(프록시/호환 API) 사용 시
# OPENAI_BASE_URL=https://...

# ============================================
# 시스템 프롬프트 파일
# ============================================
AGENTS_FILE=AGENTS.md

# ============================================
# 로그 디렉토리 분리(선택)
# data/log/<LOG_DIR>/... 형태로 기록됩니다.
# ============================================
LOG_DIR=my-project
```

### 환경변수로 바꿀 수 없는 값

아래 값들은 `src/constants/defaults.ts`에 **상수로 고정**되어 있습니다:

- 자동 라벨명: `AI_REVIEW_LABEL` (기본 `ai-review`)
- Ollama/Codex 타임아웃: `OLLAMA_TIMEOUT_SECONDS`, `CODEX_TIMEOUT_SECONDS` (기본 600초)
- Codex CLI 경로: `CODEX_CLI_PATH` (기본 `codex`)

변경하려면 해당 파일을 수정하고 `npm run build` 후 재실행하세요.

## GitLab Webhook 설정

1. GitLab 프로젝트 → **Settings** → **Webhooks**
2. 설정:
   - **URL**: `http://<your-server>:3000/webhook/gitlab`
   - **Secret Token**: `.env`의 `WEBHOOK_SECRET`과 동일한 값
   - **Trigger**: ✅ Merge request events
3. **Add webhook** 클릭

### 로컬 개발 시 (ngrok 사용)

```bash
# ngrok 설치
brew install ngrok

# 로컬 서버를 외부에 노출
ngrok http 3000

# ngrok이 제공하는 URL을 GitLab Webhook에 등록
# 예: https://abc123.ngrok.io/webhook/gitlab
```

## 실행

### 개발 모드 (watch)

```bash
npm run dev
```

특정 env/prompt 파일로 실행:

```bash
ENV_FILE=.env.my-project AGENTS_FILE=AGENTS.my-project.md npm run dev
```

레포에 포함된 예시 스크립트:

```bash
npm run dev:soop:front-end:sooplive_web
npm run dev:soop_kr:translation
```

### 프로덕션 빌드/실행

```bash
npm run build
npm start
```

프로덕션에서도 `ENV_FILE`, `AGENTS_FILE`, `LOG_DIR`를 지정할 수 있습니다:

```bash
ENV_FILE=.env.production AGENTS_FILE=AGENTS.md LOG_DIR=prod npm start
```

## API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/health` | GET | 헬스 체크 |
| `/webhook/gitlab` | POST | GitLab Webhook 수신 |

## MR "리뷰 대상" 선정 기준

`src/services/gitlab-client.ts`, `src/services/mr-processor.ts` 기준으로 다음을 만족하는 MR이 처리됩니다.

- MR 상태: `opened`
- MR에 `ai-review`(기본값) 라벨이 **없음**
- MR이 **approved 상태가 아님**
- MR이 **Draft/WIP가 아님**
- 타겟 브랜치가 제외 규칙에 걸리지 않음
  - 정확히 일치: `develop`, `prod`, `stage`
  - 포함 패턴: `release` (예: `release-1.6.51`)

## 처리 결과 / 재시도 규칙

- 리뷰 성공 시: MR에 리뷰 코멘트가 달리고 `ai-review` 라벨이 추가됩니다.
- 리뷰 실패 시: **오류 안내 코멘트**가 달리고, 그래도 `ai-review` 라벨이 추가됩니다.
- 재시도하려면: **MR에서 `ai-review` 라벨을 제거**한 뒤 MR을 업데이트하면 됩니다.

## 시스템 프롬프트 커스터마이징

- 기본: `AGENTS.md`
- 프로젝트별로: `AGENTS_FILE`로 파일을 지정

예:

```bash
AGENTS_FILE=AGENTS.front-end.sooplive_web.md npm run dev
```

## 로그/통계

### 로그 저장 위치

실행 시 `data/log/` 아래에 JSON 로그가 저장됩니다.

- `data/log/all-entries.json`: 전체 누적
- `data/log/monthly/YYYY-MM.json`: 월별
- `data/log/daily/YYYY-MM-DD.json`: 일별

`LOG_DIR`를 설정하면 `data/log/<LOG_DIR>/...`로 분리됩니다.

### 사용량 통계 CLI

```bash
npm run stats
npm run stats:daily
npm run stats:recent
npm run stats:export
```

직접 실행 예:

```bash
npx tsx src/usage-stats.ts --daily
npx tsx src/usage-stats.ts --recent 20
npx tsx src/usage-stats.ts 2026-01
```

## 트러블슈팅

### Webhook이 도착하지 않음

- 서버가 외부에서 접근 가능한지 확인 (방화벽, 포트)
- GitLab Webhook 설정에서 URL이 올바른지 확인
- Secret Token이 일치하는지 확인
- GitLab Webhook 페이지에서 "Test" 버튼으로 테스트
- Recent deliveries에서 에러 확인

### Secret 검증 실패

```
❌ Webhook Secret 검증 실패
```

- GitLab Webhook의 Secret Token과 `.env`의 `WEBHOOK_SECRET`이 일치하는지 확인

### GitLab 인증 실패 / MR 조회 실패

- `GITLAB_TOKEN` 권한(scope) 확인 (`api`, `read_api`, `write_repository`)
- `GITLAB_URL`, `GITLAB_PROJECT_ID` 값 확인

### Ollama 모델을 찾을 수 없음

- `ollama serve` 실행 여부 확인
- `OLLAMA_URL`, `OLLAMA_MODEL` 확인
- `ollama list`로 모델명 확인

### OpenAI 연결 실패

- `OPENAI_API_KEY` 확인
- `OPENAI_MODEL`이 실제로 사용 가능한 모델인지 확인
- (선택) `OPENAI_BASE_URL`을 사용하는 경우 엔드포인트 호환성 확인

### Codex CLI 실행 실패

- `codex --version` 실행 가능 여부 확인
- Codex CLI 인증은 보통 `OPENAI_API_KEY` 또는 `codex login`이 필요합니다.

## 운영 팁

- **라벨/타임아웃/CLI 경로 변경**: `src/constants/defaults.ts`
- **제외 타겟 브랜치 변경**: `src/constants/branch-filters.ts`
- **리뷰 포맷/컨벤션 강제**: `AGENTS*.md`
- **Webhook Port 변경**: `.env`에서 `WEBHOOK_PORT` 조정

## 더 알아보기

- 📖 [README.md](./README.md) - 전체 프로젝트 문서
- 🚀 [GETTING_STARTED.md](./GETTING_STARTED.md) - 빠른 시작 가이드
