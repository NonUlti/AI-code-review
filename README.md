# GitLab MR AI 리뷰 자동화 도구

로컬 Ollama 모델 또는 OpenAI 클라우드 모델을 선택하여 GitLab Merge Request를 자동으로 리뷰하는 도구입니다.

> 📖 **빠른 시작**: [GETTING_STARTED.md](./GETTING_STARTED.md) 문서를 참고하세요.

## 주요 기능

- 🔍 **자동 MR 감지**: 특정 조건에 맞는 MR을 주기적으로 검색
- 🤖 **AI 코드 리뷰**: Ollama 로컬 모델 또는 OpenAI 클라우드 모델 선택 가능
- 💬 **자동 코멘트**: 리뷰 결과를 MR에 자동으로 코멘트
- 🏷️ **라벨 관리**: 리뷰 완료된 MR에 자동으로 라벨 추가
- 🔄 **스트리밍 지원**: 대용량 MR도 타임아웃 없이 처리

## 동작 방식

1. 설정된 간격(기본 5분)마다 GitLab에서 MR 목록을 조회합니다
2. 다음 조건을 만족하는 MR을 필터링합니다:
   - `open` 상태
   - `ai-review` 라벨이 없음
   - 리뷰어가 지정되어 있음
   - Approved 되지 않음
3. 해당 MR의 변경점(changes)을 가져와 Ollama 모델에 질의합니다
4. 모델의 응답을 MR에 코멘트로 추가합니다
5. MR에 `ai-review` 라벨을 추가하여 중복 처리를 방지합니다

## 사전 요구사항

### 1. LLM Provider 선택 및 준비

#### Option A: Ollama (로컬 모델)

```bash
# Ollama 설치 (macOS)
brew install ollama

# Ollama 서버 시작
ollama serve

# 커스텀 모델 생성 (별도 터미널)
# 먼저 gpt-oss-20b 모델 다운로드
ollama pull gpt-oss-20b

# Modelfile 생성하여 커스텀 프롬프트 추가 후
ollama create ai-review-model -f Modelfile

# 모델 확인
ollama list
```

**장점**:
- ✅ 완전 무료
- ✅ 데이터가 로컬에서만 처리
- ✅ API 호출 제한 없음

**단점**:
- ❌ 로컬 GPU 리소스 필요
- ❌ 클라우드 모델 대비 성능 차이 가능

#### Option B: OpenAI (클라우드 모델)

OpenAI API 키 발급:
1. https://platform.openai.com/api-keys 접속
2. "Create new secret key" 클릭
3. API 키 복사 및 안전하게 보관

**장점**:
- ✅ 별도 인프라 불필요
- ✅ 최신 GPT 모델 사용 가능
- ✅ 높은 성능

**단점**:
- ❌ API 사용 비용 발생
- ❌ 인터넷 연결 필요
- ❌ 데이터가 OpenAI로 전송됨

### 2. GitLab Personal Access Token 생성

GitLab에서 Personal Access Token을 생성하고 다음 권한을 부여합니다:

- `api` - GitLab API 전체 접근
- `read_api` - API 읽기
- `write_repository` - MR 코멘트 작성

## 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 `.env`로 복사하고 수정합니다:

```bash
cp .env.example .env
```

#### Option A: Ollama 사용 시

```env
# LLM Provider
LLM_PROVIDER=ollama

# GitLab Configuration
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=12345678

# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=ai-review-model:latest
OLLAMA_TIMEOUT_SECONDS=600

# Scheduler Configuration
CHECK_INTERVAL_SECONDS=600

# Label Configuration
AI_REVIEW_LABEL=ai-review
```

#### Option B: OpenAI 사용 시

```env
# LLM Provider
LLM_PROVIDER=openai

# GitLab Configuration
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=12345678

# OpenAI Configuration
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4

# Scheduler Configuration
CHECK_INTERVAL_SECONDS=600

# Label Configuration
AI_REVIEW_LABEL=ai-review
```

#### 환경 변수 설명

**공통 설정**:
- `LLM_PROVIDER`: LLM 제공자 선택 (`ollama` 또는 `openai`) (기본: ollama)
- `GITLAB_URL`: GitLab 인스턴스 URL (기본: https://gitlab.com)
- `GITLAB_TOKEN`: GitLab Personal Access Token (필수)
- `GITLAB_PROJECT_ID`: 모니터링할 프로젝트 ID (필수)
- `CHECK_INTERVAL_SECONDS`: MR 체크 간격(초) (기본: 600)
- `AI_REVIEW_LABEL`: 리뷰 완료 라벨 이름 (기본: ai-review)

**Ollama 설정** (`LLM_PROVIDER=ollama` 사용 시):
- `OLLAMA_URL`: Ollama 서버 URL (기본: http://localhost:11434)
- `OLLAMA_MODEL`: 사용할 Ollama 모델 이름 (기본: ai-review-model)
- `OLLAMA_TIMEOUT_SECONDS`: 모델 응답 타임아웃(초) (기본: 600)

**OpenAI 설정** (`LLM_PROVIDER=openai` 사용 시):
- `OPENAI_API_KEY`: OpenAI API 키 (필수)
- `OPENAI_MODEL`: 사용할 OpenAI 모델 (기본: gpt-4)
  - 권장: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`

## 실행 방법

### 개발 모드 (hot reload)

```bash
npm run dev
```

### 프로덕션 빌드 및 실행

```bash
# TypeScript 컴파일
npm run build

# 실행
npm start
```

## 프로젝트 구조

```
gitlab-mcp-bridge/
├── src/
│   ├── config.ts                    # 설정 관리
│   ├── index.ts                     # 메인 진입점
│   ├── scheduler.ts                 # 스케줄러
│   ├── services/
│   │   ├── gitlab-client.ts         # GitLab API 클라이언트
│   │   ├── ollama-client.ts         # Ollama API 클라이언트
│   │   ├── openai-client.ts         # OpenAI API 클라이언트
│   │   └── mr-processor.ts          # MR 처리 워크플로우
│   ├── types/
│   │   ├── dependencies.ts          # 의존성 타입 정의
│   │   ├── gitlab.ts                # GitLab 타입 정의
│   │   └── llm.ts                   # LLM 타입 정의
│   └── utils/
│       └── prompt-builder.ts        # 프롬프트 생성
├── dist/                            # 빌드 결과물
├── package.json
├── tsconfig.json
├── .env.example                     # 환경 변수 예시
└── README.md
```

## 코드 패턴

이 프로젝트는 다음 코딩 컨벤션을 따릅니다:

- **함수**: Arrow function 형태 사용
- **이벤트 핸들러**: `handle` 접두사 사용
- **파일명**: kebab-case 사용
- **상수**: SCREAMING_SNAKE_CASE 사용

## 문제 해결

### Ollama 모델을 찾을 수 없습니다

```bash
# 모델 목록 확인
ollama list

# 모델이 없다면 다시 생성
ollama create ai-review-model -f Modelfile
```

### GitLab API 인증 실패

- Personal Access Token이 올바른지 확인
- Token에 필요한 권한(`api`, `write_repository`)이 있는지 확인
- Token이 만료되지 않았는지 확인

### MR을 찾을 수 없습니다

- `GITLAB_PROJECT_ID`가 올바른지 확인
- 프로젝트에 접근 권한이 있는지 확인
- MR이 필터 조건(open, 리뷰어 존재, approved 안됨, ai-review 라벨 없음)을 만족하는지 확인

## v1.x에서 v2.0으로 마이그레이션

v2.0에서는 OpenAI 클라우드 모델 지원이 추가되었습니다. 기존 v1.x 사용자는 다음과 같이 마이그레이션할 수 있습니다:

### 1. 코드 업데이트

```bash
git pull origin master
npm install
```

### 2. 환경 변수 추가

`.env` 파일에 `LLM_PROVIDER` 추가:

```env
# 기존 Ollama 사용자는 이렇게
LLM_PROVIDER=ollama

# 또는 OpenAI로 전환하려면
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4
```

### 3. Provider 비교

| 항목 | Ollama | OpenAI |
|------|--------|--------|
| 비용 | 무료 | 유료 (사용량 기반) |
| 설정 | 로컬 서버 필요 | API 키만 필요 |
| 성능 | GPU 리소스 의존 | 일관된 고성능 |
| 데이터 | 로컬 처리 | 클라우드 전송 |
| 인터넷 | 불필요 | 필수 |

### 4. 하이브리드 사용

개발 환경에서는 Ollama, 프로덕션에서는 OpenAI를 사용하는 것도 가능합니다:

```bash
# 개발
LLM_PROVIDER=ollama npm run dev

# 프로덕션
LLM_PROVIDER=openai npm start
```

## 라이선스

MIT

## 기여

이슈나 풀 리퀘스트를 환영합니다!
