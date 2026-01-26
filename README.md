# GitLab MR AI 리뷰 자동화 도구

GitLab Webhook을 통해 Merge Request를 자동으로 감지하고 AI 코드 리뷰를 수행하는 도구입니다.

> 📖 **빠른 시작**: [GETTING_STARTED.md](./GETTING_STARTED.md) 문서를 참고하세요.

## 주요 기능

- 🔔 **Webhook 기반 실시간 감지**: MR 생성/업데이트 시 즉시 리뷰 시작
- 🤖 **AI 코드 리뷰**: Ollama 로컬 모델, OpenAI 클라우드 모델, 또는 Codex CLI 선택 가능
- 💬 **자동 코멘트**: 리뷰 결과를 MR에 자동으로 코멘트
- 🏷️ **라벨 관리**: 리뷰 완료된 MR에 자동으로 라벨 추가
- 🔄 **스트리밍 지원**: 대용량 MR도 타임아웃 없이 처리
- 📊 **토큰 사용량 추적**: 일별/월별 비용 추적

## 동작 방식

```
GitLab Webhook → HTTP Server → MR 처리 → AI 리뷰 → 코멘트 작성
```

1. GitLab에서 MR 이벤트(open, update) 발생 시 Webhook 전송
2. 서버가 Webhook을 수신하고 Secret 토큰 검증
3. MR 조건 확인 (ai-review 라벨 없음, approved 안됨, 제외 브랜치 아님)
4. LLM에 코드 리뷰 요청
5. 리뷰 결과를 MR에 코멘트로 작성
6. `ai-review` 라벨 추가로 중복 처리 방지

## 사전 요구사항

### 1. LLM Provider 선택

#### Option A: Ollama (로컬 모델)

```bash
# Ollama 설치 (macOS)
brew install ollama

# Ollama 서버 시작
ollama serve

# 모델 다운로드 및 생성
ollama pull gpt-oss-20b
ollama create ai-review-model -f Modelfile
```

**장점**: 무료, 데이터 로컬 처리, API 제한 없음
**단점**: 로컬 GPU 필요

#### Option B: OpenAI (클라우드 모델)

1. https://platform.openai.com/api-keys 에서 API 키 발급
2. `.env`에 `OPENAI_API_KEY` 설정

**장점**: 별도 인프라 불필요, 높은 성능
**단점**: 유료, 데이터 외부 전송

#### Option C: Codex CLI

```bash
npm install -g @openai/codex
```

**장점**: CLI 기반 간편 사용
**단점**: Codex CLI 설치 필요, OpenAI API 키 필요

### 2. GitLab Personal Access Token 생성

필요 권한:
- `api` - GitLab API 전체 접근
- `read_api` - API 읽기
- `write_repository` - MR 코멘트 작성

## 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

```env
# LLM Provider
LLM_PROVIDER=ollama  # 또는 openai, codex

# GitLab Configuration
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=12345678

# Webhook Server Configuration
WEBHOOK_PORT=3000
WEBHOOK_HOST=0.0.0.0
WEBHOOK_SECRET=your-secret-token  # GitLab Webhook에서 사용할 Secret

# Ollama Configuration (LLM_PROVIDER=ollama)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=ai-review-model:latest

# OpenAI Configuration (LLM_PROVIDER=openai)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4
```

### 3. GitLab Webhook 설정

1. GitLab 프로젝트 → Settings → Webhooks
2. URL: `http://<your-server>:3000/webhook/gitlab`
3. Secret Token: `.env`의 `WEBHOOK_SECRET`과 동일한 값
4. Trigger:
   - ✅ Merge request events
5. "Add webhook" 클릭

## 실행 방법

### 개발 모드 (hot reload)

```bash
npm run dev
```

### 프로덕션 빌드 및 실행

```bash
npm run build
npm start
```

### 멀티 프로젝트 실행

```bash
# 프로젝트별 환경 파일 사용
ENV_FILE=.env.project1 AGENTS_FILE=AGENTS.project1.md npm run dev
```

## API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/health` | GET | 헬스 체크 |
| `/webhook/gitlab` | POST | GitLab Webhook 수신 |

## 프로젝트 구조

```
gitlab-mcp-bridge/
├── src/
│   ├── config.ts                    # 설정 관리
│   ├── index.ts                     # 메인 진입점
│   ├── server.ts                    # Fastify HTTP 서버
│   ├── services/
│   │   ├── gitlab-client.ts         # GitLab API 클라이언트
│   │   ├── ollama-client.ts         # Ollama API 클라이언트
│   │   ├── openai-client.ts         # OpenAI API 클라이언트
│   │   ├── codex-client.ts          # Codex CLI 클라이언트
│   │   └── mr-processor.ts          # MR 처리 워크플로우
│   ├── webhook/
│   │   ├── webhook-handler.ts       # Webhook 이벤트 처리
│   │   └── webhook-validator.ts     # Secret/Payload 검증
│   ├── types/
│   │   ├── dependencies.ts          # 의존성 타입 정의
│   │   ├── gitlab.ts                # GitLab 타입 정의
│   │   ├── llm.ts                   # LLM 타입 정의
│   │   └── webhook.ts               # Webhook 타입 정의
│   ├── constants/
│   │   ├── defaults.ts              # 기본값 상수
│   │   ├── branch-filters.ts        # 브랜치 필터 설정
│   │   └── llm-providers.ts         # LLM Provider 상수
│   └── utils/
│       ├── prompt-builder.ts        # 프롬프트 생성
│       ├── token-counter.ts         # 토큰 사용량 계산
│       └── usage-logger.ts          # 사용량 로깅
├── data/log/                        # 로그 및 통계
├── dist/                            # 빌드 결과물
├── package.json
├── tsconfig.json
├── .env.example
├── AGENTS.md                        # 시스템 프롬프트
├── README.md
├── USAGE_GUIDE.md
└── GETTING_STARTED.md
```

## 문제 해결

### Webhook이 도착하지 않습니다

- 서버가 외부에서 접근 가능한지 확인 (방화벽, 포트 개방)
- GitLab Webhook 설정에서 URL이 올바른지 확인
- Secret Token이 일치하는지 확인
- GitLab Webhook 페이지에서 "Test" 버튼으로 테스트

### 로컬 개발 시 Webhook 테스트

```bash
# ngrok 설치
brew install ngrok

# 로컬 서버를 외부에 노출
ngrok http 3000

# ngrok이 제공하는 URL을 GitLab Webhook에 등록
# 예: https://abc123.ngrok.io/webhook/gitlab
```

### GitLab API 인증 실패

- Personal Access Token이 올바른지 확인
- Token에 필요한 권한(`api`, `write_repository`)이 있는지 확인
- Token이 만료되지 않았는지 확인

## Polling에서 Webhook으로 마이그레이션

기존 v1.x (Polling 방식) 사용자는 다음과 같이 마이그레이션합니다:

### 1. 코드 업데이트

```bash
git pull origin master
npm install
```

### 2. 환경 변수 추가

```env
# 기존 CHECK_INTERVAL_SECONDS 제거
# 아래 Webhook 설정 추가
WEBHOOK_PORT=3000
WEBHOOK_HOST=0.0.0.0
WEBHOOK_SECRET=your-secret-token
```

### 3. GitLab Webhook 설정

프로젝트 Settings → Webhooks에서 Webhook 추가

### 4. 비교

| 항목 | Polling (기존) | Webhook (현재) |
|------|---------------|----------------|
| 응답 시간 | 최대 60초 | 즉시 (<1초) |
| API 호출 | 시간당 60회 | 이벤트 발생 시만 |
| 리소스 효율 | 낮음 | 높음 |
| 인프라 | 클라이언트만 | HTTP 서버 필요 |

## 추가 문서

- 📖 [USAGE_GUIDE.md](./USAGE_GUIDE.md) - 상세 사용 가이드
- 🚀 [GETTING_STARTED.md](./GETTING_STARTED.md) - 빠른 시작 가이드

## 라이선스

MIT

## 기여

이슈나 풀 리퀘스트를 환영합니다!
