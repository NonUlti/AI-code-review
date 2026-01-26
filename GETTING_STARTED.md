# 시작 가이드

## 빠른 시작

### 1. LLM Provider 준비

#### Option A: Ollama (로컬 모델)

```bash
# Ollama 서버 시작
ollama serve
```

별도 터미널에서:

```bash
# 모델 확인
ollama list | grep ai-review-model
```

모델이 없다면 생성:

```bash
# 기본 모델 다운로드
ollama pull gpt-oss-20b

# 커스텀 모델 생성
ollama create ai-review-model -f Modelfile
```

#### Option B: OpenAI (클라우드 모델)

1. https://platform.openai.com/api-keys 에서 API 키 발급
2. `.env`에 설정:
   ```env
   LLM_PROVIDER=openai
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
   OPENAI_MODEL=gpt-4
   ```

### 2. GitLab 설정

#### GitLab Personal Access Token 생성

1. GitLab에 로그인
2. Settings > Access Tokens 메뉴로 이동
3. 새 토큰 생성:
   - Name: `gitlab-mcp-bridge`
   - Scopes:
     - ✅ `api`
     - ✅ `read_api`
     - ✅ `write_repository`
4. 생성된 토큰을 복사 (한 번만 표시됨)

#### 프로젝트 ID 찾기

GitLab 프로젝트 페이지에서:
- Settings > General로 이동
- Project ID를 확인

### 3. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 편집
vi .env
```

`.env` 예시:

```env
# LLM Provider (ollama, openai, codex 중 선택)
LLM_PROVIDER=ollama

# GitLab
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=12345678

# Webhook Server
WEBHOOK_PORT=3000
WEBHOOK_HOST=0.0.0.0
WEBHOOK_SECRET=your-secret-token

# Ollama (LLM_PROVIDER=ollama 사용 시)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=ai-review-model
```

### 4. GitLab Webhook 설정

1. GitLab 프로젝트 → **Settings** → **Webhooks**
2. 설정:
   - **URL**: `http://<your-server>:3000/webhook/gitlab`
   - **Secret Token**: `.env`의 `WEBHOOK_SECRET`과 동일한 값
   - **Trigger**: ✅ Merge request events
3. **Add webhook** 클릭

### 5. 실행

```bash
# 의존성 설치
npm install

# 개발 모드로 실행 (권장)
npm run dev

# 또는 빌드 후 실행
npm run build
npm start
```

## 동작 확인

프로그램이 실행되면 다음과 같은 출력을 볼 수 있습니다:

```
╔════════════════════════════════════════════════════════╗
║       GitLab MR AI 리뷰 자동화 도구                        ║
║       Powered by Ollama ai-review-model                ║
║       Mode: Webhook Server                                ║
╚════════════════════════════════════════════════════════╝

✓ 설정 검증 완료:
  - LLM Provider: ollama
  - GitLab URL: https://gitlab.com
  - GitLab Project ID: 12345678
  - Ollama URL: http://localhost:11434
  - Ollama Model: ai-review-model
  - Webhook Port: 3000
  - Webhook Secret: 설정됨

🔍 Ollama 모델 확인 중...
✓ Ollama 모델 사용 가능

🌐 Webhook 서버 시작됨
   - 주소: http://0.0.0.0:3000
   - Webhook URL: http://<your-domain>:3000/webhook/gitlab
   - Health Check: http://0.0.0.0:3000/health

✓ 서버가 정상적으로 시작되었습니다.
  Ctrl+C를 눌러 종료할 수 있습니다.
```

Webhook이 수신되면:

```
⏰ [2024-10-15 16:53:44] Webhook 요청 수신
   ✓ Webhook Secret 검증 성공

🔔 Webhook 수신: MR !123 - open
   제목: feat: 새로운 기능 추가
   상태: opened
   브랜치: feature/new-feature → main
   ✓ 처리 시작...

📝 MR !123 처리 시작: feat: 새로운 기능 추가
✓ 3개의 파일 변경 발견
🔄 스트리밍 모드로 AI 리뷰 요청 중...
✓ MR !123에 코멘트 추가 완료
✓ MR !123에 라벨 "ai-review" 추가 완료
✅ MR !123 처리 완료
```

## 테스트

### 로컬 개발 시 Webhook 테스트 (ngrok 사용)

```bash
# ngrok 설치
brew install ngrok

# 로컬 서버를 외부에 노출
ngrok http 3000

# ngrok이 제공하는 URL을 GitLab Webhook에 등록
# 예: https://abc123.ngrok.io/webhook/gitlab
```

### 테스트 MR 만들기

1. GitLab 프로젝트에서 테스트 브랜치 생성
2. 간단한 코드 변경 후 커밋
3. Merge Request 생성:
   - `ai-review` 라벨이 없는지 확인
   - Draft/WIP가 아닌지 확인
4. Webhook이 자동으로 트리거되어 AI 리뷰 추가

## 문제 해결

### Webhook이 도착하지 않음

- 서버가 외부에서 접근 가능한지 확인
- 방화벽/포트 설정 확인
- GitLab Webhook 페이지에서 "Test" 버튼으로 테스트
- Recent deliveries에서 에러 확인

### Ollama 연결 실패

```
❌ Ollama 모델을 사용할 수 없습니다.
```

해결:
- `ollama serve` 실행 확인
- `OLLAMA_URL` 환경 변수 확인
- `ollama list`로 모델 존재 확인

### GitLab 인증 실패

```
❌ MR 목록 조회 실패: Unauthorized
```

해결:
- `GITLAB_TOKEN`이 올바른지 확인
- 토큰 권한 확인 (`api`, `write_repository`)
- 토큰이 만료되지 않았는지 확인

### Secret 검증 실패

```
❌ Webhook Secret 검증 실패
```

해결:
- GitLab Webhook의 Secret Token과 `.env`의 `WEBHOOK_SECRET`이 일치하는지 확인

## 다음 단계

- 프롬프트 커스터마이징 (`AGENTS.md` 수정)
- 브랜치 필터 조정 (`src/constants/branch-filters.ts`)
- 멀티 프로젝트 설정 (환경 파일 분리)

### 더 알아보기

- 📖 [USAGE_GUIDE.md](./USAGE_GUIDE.md) - 상세 사용 가이드
- 📖 [README.md](./README.md) - 전체 프로젝트 문서
