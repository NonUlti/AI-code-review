# GitLab MR AI 리뷰 자동화 도구

Ollama의 `ai-review-model` 모델을 사용하여 GitLab Merge Request를 자동으로 리뷰하는 도구입니다.

> 📖 **빠른 시작**: [GETTING_STARTED.md](./GETTING_STARTED.md) 문서를 참고하세요.

## 주요 기능

- 🔍 **자동 MR 감지**: 특정 조건에 맞는 MR을 주기적으로 검색
- 🤖 **AI 코드 리뷰**: Ollama 로컬 모델을 사용한 자동 리뷰
- 💬 **자동 코멘트**: 리뷰 결과를 MR에 자동으로 코멘트
- 🏷️ **라벨 관리**: 리뷰 완료된 MR에 자동으로 라벨 추가

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

### 1. Ollama 설치 및 모델 준비

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

`env.example` 파일을 `.env`로 복사하고 수정합니다:

```bash
cp env.example .env
```

`.env` 파일 예시:

```env
# GitLab Configuration
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=12345678

# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=ai-review-model

# Scheduler Configuration
CHECK_INTERVAL_SECONDS=10

# Label Configuration
AI_REVIEW_LABEL=ai-review
```

#### 환경 변수 설명

- `GITLAB_URL`: GitLab 인스턴스 URL (기본: https://gitlab.com)
- `GITLAB_TOKEN`: GitLab Personal Access Token (필수)
- `GITLAB_PROJECT_ID`: 모니터링할 프로젝트 ID (필수)
- `OLLAMA_URL`: Ollama 서버 URL (기본: http://localhost:11434)
- `OLLAMA_MODEL`: 사용할 Ollama 모델 이름 (기본: ai-review-model)
- `CHECK_INTERVAL_SECONDS`: MR 체크 간격(초) (기본: 10)
- `AI_REVIEW_LABEL`: 리뷰 완료 라벨 이름 (기본: ai-review)

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
│   │   └── mr-processor.ts          # MR 처리 워크플로우
│   └── utils/
│       └── prompt-builder.ts        # 프롬프트 생성
├── dist/                            # 빌드 결과물
├── package.json
├── tsconfig.json
├── env.example                      # 환경 변수 예시
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

## 라이선스

MIT

## 기여

이슈나 풀 리퀘스트를 환영합니다!
