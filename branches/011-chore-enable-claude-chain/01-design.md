# 011 chore/enable-claude-chain — 설계 문서

## 목표

배포(운영) 리딩 체인에 Claude를 추가해, 무료 Workers AI 할당량이 소진된 뒤에도 결과 화면의 "목소리 리딩"이 나오게 한다.
함께, 010에서 미확인으로 남긴 무료 모델(`@cf/meta/llama-3.3-70b-instruct-fp8-fast`)의 실제 ko/en 출력 품질을 실측해 기록하고, 부족하면 모델 상수를 바꾼다.

## 범위

### 포함

- 무료 모델 실측(ko/en 각 1회) 기록. 품질이 부족하면 `worker/ai/workersAiText.ts`의 모델 상수 교체(후보 비교 근거 포함)
- 운영 Worker에 비밀 `ANTHROPIC_API_KEY` 등록 — **사용자가 직접** `wrangler secret put`으로 넣는다. 키 값은 채팅·저장소·`wrangler.jsonc`·대시보드 변수 어디에도 두지 않는다
- `wrangler.jsonc`의 `vars.TEXT_PROVIDER`: `"workers-ai"` → `"workers-ai,claude"`(순서는 실측 결과로 정한다), `worker-configuration.d.ts` 재생성
- README "체인에 Claude 추가하기"는 그대로 맞다(012 뒤 설정 파일 `name`과 배포 Worker 이름이 모두 `vocatype`이라 `--name` 없이 동작)

### 제외

- 체인 코드 변경 없음. 010의 폴백·시간 예산(25초)·로그·공용 출력 검증이 그대로 적용된다
- 초상(이미지) 제공자 변경 없음

## 현황 (2026-10-20 12:30 KST, 012~014 병합 뒤 리베이스)

| 항목 | 확인 결과 |
| --- | --- |
| 배포 주소 | `https://vocatype.hs827.workers.dev`(012에서 이름 변경). `GET /api/config` → `{"provider":"workers-ai","textProviders":["workers-ai"],"features":{"portrait":true,"reading":true}}` |
| 배포 Worker 이름 | `vocatype`. `wrangler.jsonc`의 `name`도 `vocatype`이라 `wrangler secret`·`wrangler tail`에 `--name`이 필요 없다. (012 이전에는 배포 이름 `ai-voice-analyser`와 설정 이름이 달라 `--name`이 필요했다. 옛 Worker는 사용자가 지울 때까지 아직 응답한다) |
| 운영 비밀 | `npx wrangler secret list` → `ANTHROPIC_API_KEY`(secret_text) 있음. 03:10Z "Secret Change" 배포로 등록됨. 값은 어디에도 없고 이름만 확인했다 |
| 무료 할당량 | 12:06 KST 소진 확인. 로컬 workerd(`--var TEXT_PROVIDER:workers-ai`)에서 `POST /api/reading` → `[reading] workers-ai failed, falling back: AiError: 4006: you have used up your daily free allocation of 10,000 neurons …` → `provider: "mock"`. 010 작업(11:50 KST)에서 이미 소진 상태였다. 지금 배포본은 체인이 `workers-ai`뿐이라 리딩이 화면에 보이지 않는다(카탈로그 설명으로 폴백) |
| 생성 타입 | 012가 재생성한 `worker-configuration.d.ts`는 로컬 `.dev.vars` 때문에 `AI_PROVIDER`·`TEXT_PROVIDER`가 `string`, `ANTHROPIC_API_KEY`가 들어간 상태로 커밋돼 있다. 이 작업에서 깨끗한 출력(리터럴, 비밀 없음)으로 되돌린다 |
| 로컬 `.dev.vars` | `TEXT_PROVIDER=claude`(키 줄 있음). 이 작업은 이 파일을 건드리지 않는다 |

## 절차

1. 설계 문서(이 문서) 작성·커밋
2. **무료 모델 품질 실측** — 할당량이 초기화된 뒤(하루 단위, UTC 자정 = KST 09:00으로 가정):
   - `.dev.vars`를 고치지 않고 `npm run build` 뒤 `npx wrangler dev -c dist/worker/wrangler.json --port 8788 --var TEXT_PROVIDER:workers-ai`로 체인을 workers-ai만으로 고정한다(010과 같은 방법. 5173의 개발 서버는 그대로 둔다)
   - README의 curl 예시로 ko(`WFQV`)·en(`CFQV`) 각 1회 호출해 `provider: "workers-ai"` 응답을 기록한다: 문장 수(3~4), 캡션 길이(ko 28자 / en 60자 이내), 성별·나이 표현 부재, 한국어 자연스러움(해요체, "당신" 반복 없음), 수치·축 이름·타입 코드 인용 없음, 소요 시간과 토큰 수
   - 부족하면 후보 모델을 **같은 프롬프트·같은 입력 빌더·같은 파서**로 비교한다(저장소 밖 임시 하네스가 `buildWorkersAiTextInput`·`parseWorkersAiTextResult`를 그대로 import해 모델 이름만 바꿔 부른다). 후보는 생성 타입(`worker-configuration.d.ts`)에 `response_format` JSON 모드가 있어 상수만 바꾸면 되는 모델로 한정한다:
     - `@cf/meta/llama-4-scout-17b-16e-instruct`
     - `@cf/qwen/qwen3-30b-a3b-fp8`
     - 제외: `@cf/google/gemma-3-12b-it`, `@cf/mistralai/mistral-small-3.1-24b-instruct`는 생성 타입이 `guided_json`이라 입력 빌더를 고쳐야 하고, `@cf/openai/gpt-oss-*`는 Responses 입력 형태라 어댑터를 새로 써야 한다
   - 그래도 부족하면 체인 순서를 `"claude,workers-ai"`로 두는 선택지(무료 모델은 Claude 실패 시 예비)를 사용자에게 제시한다
3. **비밀 등록**: 사용자가 직접 실행한다(설정 이름이 `vocatype`이라 `--name` 생략 가능). 완료 확인은 `npx wrangler secret list`로 이름만 본다
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   ```
   → 2026-10-20 12:10 KST에 등록 완료 확인(위 현황)
4. `wrangler.jsonc` `vars.TEXT_PROVIDER` 변경 → `npm run cf-typegen` → 로컬 `.dev.vars` 때문에 `Env.TEXT_PROVIDER`가 `string`으로 넓어지거나 비밀 이름이 들어가면 깨끗한 출력대로 복원(010과 같은 처리) → typecheck / lint / test / build → `chore(ai-adapter): 배포 리딩 체인에 claude 추가` 커밋
5. 02 구현 문서, 자체 리뷰로 03 리뷰 문서(008 형식) → `--no-ff` 병합 → 브랜치 삭제 → 사용자 확인 뒤 푸시
6. **배포 후 확인**: `GET /api/config`의 `textProviders`에 `claude`가 있는지, `POST /api/reading`이 200으로 `provider`와 함께 오는지. 실패하면 `npx wrangler tail`의 `[reading]` 줄을 본다. 결과를 02 문서 "배포 후 확인" 절에 기록하고 docs 커밋을 main에 추가한다

## 비용 상한 근거

- Claude 호출은 체인에서 **앞 제공자가 실패했을 때만** 나간다. 순서가 `workers-ai,claude`면 무료 할당량이 남아 있는 동안 Claude 비용은 0이다. 할당량은 초상(1장 약 1,400~1,500뉴런)이 먼저 소진시키므로, 하루 6~7장 뒤부터 리딩이 Claude로 넘어간다
- `READING_LIMITER`: 접속 IP당 1분 5회(콜로별), 초과 시 429. 교차 사이트 요청 403, 요청 본문 1KB 초과 413, 체인 전체 25초 예산(클라이언트가 포기한 뒤 유료 호출이 나가지 않음) — 모두 010 그대로
- Claude(Haiku 5.5) 1회 약 **$0.0002**(010 실측: 입력 약 1,200토큰 + 출력 약 200토큰)
- 최악의 경우(한 IP가 한 콜로에서 쉬지 않고 한도를 채움): 5 × 60 × 24 = 7,200회/일 ≈ **$1.44/일**. 현실적 사용량(하루 수십 회)은 센트 단위다. 키의 Anthropic 콘솔 지출 한도는 별도로 둘 수 있다
- 되돌리기: `vars.TEXT_PROVIDER`를 `"workers-ai"`로 되돌려 푸시(설정 한 줄, 코드 변경 없음). 키를 없애려면 `npx wrangler secret delete ANTHROPIC_API_KEY`. 키가 없으면 `claude`는 체인에서 조용히 빠진다

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| 비밀은 사용자가 `wrangler secret put`으로 직접 | 키 값이 에이전트·채팅·저장소를 거치지 않는다. 확인은 `secret list`의 이름만으로 충분하다 |
| 체인 순서는 실측 뒤 결정 | "최대한 무료" 원칙은 유지하되, 무료 모델 품질이 사용자에게 보일 수준이 아니면 순서를 뒤집는 것이 낫다. 설정 한 줄이라 양쪽 모두 되돌리기 쉽다 |
| 후보 모델은 `response_format` 지원 모델만 | 상수 교체만으로 끝나야 chore 범위다. 입력 빌더를 고치면 테스트·타입이 함께 바뀌어 별도 작업이 된다 |
| 실측은 `.dev.vars` 수정 없이 `--var`로 | 키 줄을 건드리지 않고, 5173 개발 서버(현재 `TEXT_PROVIDER=claude`)와 분리된다 |

## 검증 계획

1. 무료 모델 ko/en 실제 응답이 02 문서에 기록돼 있다(필요하면 상수 교체와 비교 근거 포함)
2. `npx wrangler secret list`에 `ANTHROPIC_API_KEY` 이름만 보인다. `git grep -i 'sk-ant'`가 비어 있다
3. typecheck / lint / test / build 통과. `dist/worker/wrangler.json`의 `vars.TEXT_PROVIDER`가 바뀐 값이다
4. 배포 후 `/api/config`의 `textProviders`에 `claude`, `/api/reading` 200 + `provider`
