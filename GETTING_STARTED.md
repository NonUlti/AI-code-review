# 시작 가이드

## 빠른 시작

### 1. Ollama 모델 준비

먼저 Ollama가 설치되어 있고 `ai-review-model` 모델이 생성되어 있어야 합니다.

```bash
# Ollama 서버 시작
ollama serve
```

별도 터미널에서:

```bash
# 모델 확인
ollama list | grep ai-review-model
```

모델이 없다면 생성해야 합니다:

```bash
# 기본 모델 다운로드
ollama pull gpt-oss-20b

# Modelfile 생성 (예시)
cat > Modelfile << 'EOF'
FROM gpt-oss-20b

SYSTEM """
당신은 코드 리뷰 전문가입니다.
GitLab Merge Request의 변경사항을 분석하고 다음 형식으로 리뷰를 제공합니다:

## 📋 변경 사항 요약
- 변경된 파일 개수와 주요 변경 내용

## 🔍 코드 리뷰
- 좋은 점
- 개선이 필요한 점
- 잠재적 버그나 이슈

## 💡 제안사항
- 구체적인 개선 방향

리뷰는 건설적이고 명확하게 작성하세요.
"""
EOF

# 커스텀 모델 생성
ollama create ai-review-model -f Modelfile
```

### 2. GitLab 설정

#### GitLab Personal Access Token 생성

1. GitLab에 로그인
2. Settings > Access Tokens 메뉴로 이동
3. 새 토큰 생성:
   - Name: `gitlab-mcp-bridge` (원하는 이름)
   - Scopes:
     - ✅ `api`
     - ✅ `read_api`
     - ✅ `write_repository`
4. 생성된 토큰을 안전한 곳에 복사 (한 번만 표시됨)

#### 프로젝트 ID 찾기

GitLab 프로젝트 페이지에서:

- Settings > General로 이동
- Project ID를 확인

또는 프로젝트 URL에서:

- `https://gitlab.com/username/project` → API에서 프로젝트 ID 확인

### 3. 환경 변수 설정

```bash
# .env 파일 생성
cp .env

# .env 파일 편집
vi .env
```

`.env` 예시:

```env
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=12345678

OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=ai-review-model

CHECK_INTERVAL_SECONDS=10

AI_REVIEW_LABEL=ai-review
```

### 4. 실행

```bash
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
╚════════════════════════════════════════════════════════╝

✓ 설정 검증 완료:
  - GitLab URL: https://gitlab.com
  - GitLab Project ID: 12345678
  - Ollama URL: http://localhost:11434
  - Ollama Model: ai-review-model
  - Check Interval: 600초
  - AI Review Label: ai-review

🚀 스케줄러 시작 (600초 간격)

⏰ [2024-10-15 16:53:44] MR 체크 시작

🔍 AI 리뷰 대상 MR 검색 중...
✓ 2개의 MR 발견

📝 MR !123 처리 시작: feat: 새로운 기능 추가
✓ 3개의 파일 변경 발견
🤖 ai-review-model 모델에 질의 중...
✓ 모델 응답 수신 완료
✓ MR !123에 코멘트 추가 완료
✓ MR !123에 라벨 "ai-review" 추가 완료
✅ MR !123 처리 완료
```

## 테스트 MR 만들기

실제로 동작하는지 확인하려면:

1. GitLab 프로젝트에서 테스트 브랜치 생성
2. 간단한 코드 변경 후 커밋
3. Merge Request 생성:
   - 리뷰어를 한 명 이상 지정
   - `ai-review` 라벨이 없는지 확인
4. MR을 Approve하지 않은 상태로 유지
5. 프로그램이 다음 주기에 자동으로 리뷰 추가

## 문제 해결

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

### MR을 찾을 수 없음

```
ℹ️  처리할 MR이 없습니다.
```

확인:

- MR이 `open` 상태인가?
- 리뷰어가 지정되어 있나?
- `ai-review` 라벨이 이미 있지 않나?
- Approved 되지 않았나?

## 다음 단계

- 실제 프로젝트에 적용
- 프롬프트 커스터마이징
- 체크 간격 조정
- 추가 필터 조건 구현
