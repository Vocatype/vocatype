# 022 chore/claude-first-reading — 구현 문서

## 요약

리딩 체인 순서를 `workers-ai,claude`에서 `claude,workers-ai`로 바꿨다. 코드 변경 없이 설정 한 줄과 생성 타입, 문서, 테스트만 바꿨다.
이제 키가 있으면 모든 리딩을 Claude(`claude-haiku-5-5`)가 먼저 만들고, Claude가 실패하면 무료 Workers AI(Llama 4 Scout)가 받치고, 둘 다 실패하면 지금처럼 mock(화면에는 카탈로그 설명)으로 끝난다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `wrangler.jsonc` | `vars.TEXT_PROVIDER`: `"workers-ai,claude"` → `"claude,workers-ai"`. 설정 주석에 세 가지 순서와 현재 값, "키가 없으면 claude는 조용히 빠진다"를 적고, AI 바인딩 주석의 "workers-ai(기본값)"를 "현재는 Claude 실패 시 예비"로 |
| `worker-configuration.d.ts` | `npm run cf-typegen` 재생성. 바뀐 것은 해시 줄과 `TEXT_PROVIDER: "claude,workers-ai"` 두 줄뿐(이 워크트리에는 `.dev.vars`가 없어 타입이 넓어지지 않았다) |
| `README.md` | 첫 소개 문단의 체인 순서(1차 리뷰 #1), 프로젝트 구조의 `worker/ai/` 설명 순서, 기술 스택 표의 AI 줄 순서, 텍스트 제공자 절의 원칙 문장(022 근거 문서 링크)·체인 그림·폴백 로그 예시·설정 표(`claude,workers-ai` 현재 행 추가, `workers-ai`의 "(기본)" 표시 제거), "체인에 Claude 추가하기" 2~4단계(3단계는 두 순서의 기대값, 4단계는 로컬 호출도 Anthropic 과금이 생긴다는 안내), 데이터 절("리딩 요청마다 Anthropic으로 간다"), 비용 절(출력 160~264토큰 실측, 할당량은 사실상 초상이 쓰고 리딩을 빼도 초상 장수는 거의 늘지 않음, IP당 최대 $1.44~1.8/일, 전체 상한은 콘솔 지출 한도뿐) |
| `shared/api.ts` | `TextProviderName` 주석의 고정 순서 `workers-ai → claude → mock`을 "`TEXT_PROVIDER` 순서의 폴백 체인(운영: claude → workers-ai, mock 은 항상 마지막)"으로 |
| `worker/index.test.ts` | 운영 순서 라우트 테스트 2건 추가(아래). 체인 순서를 `PRODUCTION_TEXT_PROVIDER = 'claude,workers-ai' satisfies Env['TEXT_PROVIDER']`로 생성 타입에 묶었다(1차 리뷰 #9) |
| `branches/022-chore-claude-first-reading/` | 설계·구현·리뷰 문서 |

체인 코드(`worker/ai/textChain.ts`), 제공자(`claude.ts`, `workersAiText.ts`), 프롬프트, 출력 검증, 클라이언트는 바꾸지 않았다.

## 추가한 테스트

| 테스트 | 확인하는 것 |
| --- | --- |
| 체인(운영 순서 claude,workers-ai): claude 가 실패하면 workers-ai 가 답한다 | `/api/config`의 `textProviders`가 `["claude","workers-ai"]`. Anthropic이 401(키 오류)을 주면 SDK는 재시도하지 않고(`fetch` 1회), 남은 예산으로 Workers AI(`@cf/meta/llama-4-scout-17b-16e-instruct`)가 1회 호출되어 `provider: "workers-ai"`로 200. 첫 경고 로그가 `[reading] claude failed, falling back:` |
| 체인(운영 순서 claude,workers-ai): claude 가 성공하면 workers-ai 는 부르지 않는다 | 응답이 Claude 문장 그대로이고 `provider: "claude"`, `AI.run`은 0회 |

기존 `buildTextChain` 단위 테스트에 `claude,workers-ai` 순서 행이 이미 있어(`textChain.test.ts` "둘 다 있으면 목록 순서대로"), 이번에는 라우트 수준의 실제 경로만 더했다.

생성 타입 묶임 확인: `worker-configuration.d.ts`의 리터럴을 잠시 옛 값(`"workers-ai,claude"`)으로 바꿔 `npx tsc -b`를 돌리면 종료 코드 1, `worker/index.test.ts(10,54): error TS1360: Type '"claude,workers-ai"' does not satisfy the expected type '"workers-ai,claude"'`로 실패했다. 파일은 바로 되돌렸다(`git diff` 없음). 즉 설정을 바꾸고 `npm run cf-typegen`을 돌리면 이 테스트를 함께 고치게 된다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 구현자 확인에서 workers-ai가 답하는 것까지 확인 | Claude 401 → workers-ai **시도**까지 확인, workers-ai는 `4006`(무료 할당량 소진)으로 실패해 mock | 확인 시각(2026-10-20 14:50 KST)에 오늘 무료 할당량이 이미 소진돼 있었다. 체인 순서와 폴백 동작은 로그로 확인됐고, Workers AI가 성공하는 경로는 라우트 테스트가 고정한다 |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 종료 코드 0 |
| 린트 | `npm run lint` | 종료 코드 0 |
| 단위 테스트 | `npm test` | 종료 코드 0, 29 파일 195 테스트 통과(라우트 파일 16건, 새 2건 포함). 1차 리뷰 반영 뒤 다시 실행해도 같다 |
| 빌드 | `npm run build` | 종료 코드 0. `dist/worker/wrangler.json` → `name: vocatype`, `vars: { AI_PROVIDER: "workers-ai", TEXT_PROVIDER: "claude,workers-ai" }` |

### 구현자 확인 (빌드본, workerd)

`npx wrangler dev -c dist/worker/wrangler.json --port 8788 --var ANTHROPIC_API_KEY:<가짜 키>`(가짜 키라 Anthropic 과금 없음, `.dev.vars` 없음):

| 호출 | 결과 |
| --- | --- |
| `GET /api/config` | `{"provider":"workers-ai","textProviders":["claude","workers-ai"],"features":{"portrait":true,"reading":true}}` — **claude가 앞** |
| `POST /api/reading` ko `WFQV` | 200, 0.8초, `provider: "mock"` |
| Worker 로그 | `[reading] claude failed, falling back: Error: 401 … invalid x-api-key` → `[reading] workers-ai failed, falling back: AiError: 4006: you have used up your daily free allocation of 10,000 neurons …` → `[reading] all providers failed (…), using mock` |

- 순서대로 claude를 먼저 시도하고, 빠른 실패(401) 뒤 남은 예산으로 workers-ai를 시도하는 것이 실제 번들에서 확인됐다.
- 로그에는 오류 이름·메시지만 있고 요청 본문·축 값·키는 없다.
- 참고: 로컬 바인딩도 운영과 같은 계정의 할당량을 쓰므로, 할당량이 소진된 지금은 운영 체인(`workers-ai,claude`)도 이미 Claude가 답하고 있을 것이다. 이 변경은 할당량이 남아 있는 시간대(하루 첫 6~7장 전후)의 리딩도 Claude로 맞춘다.

## 알려진 한계

- **느린 Claude 실패에서는 Llama 예비가 작동하지 않는다.** 12초 타임아웃 2회나 긴 `retry-after`로 체인 예산(25초)을 거의 다 쓰면, 남은 시간이 3초 미만이라 workers-ai를 건너뛰고 mock으로 끝난다(설계 문서 "시간 예산과 폴백의 한계"). 고치려면 앞 제공자에 자기 몫 예산 상한을 두는 체인 코드 변경이 필요하다. 020(타임아웃 상수 정리) 뒤 후속 작업 후보다.
- **workers-ai가 둘째일 때 클라이언트 30초를 넘을 수 있다.** Workers AI 텍스트 제공자는 체인의 중단 신호를 받지 않아, 남은 예산 3초 남짓에서 시작해 2~9초가 걸리면 서버 합계가 약 31초가 된다. 그때 클라이언트는 리딩 없이 진행한다. 무료 호출이라 비용 문제는 아니다. 020이 신호를 넘기면 해소된다.
- 모든 리딩이 Anthropic으로 나가므로 비용이 생긴다(1회 약 $0.0002). IP당 최대는 $1.44~1.8/일이지만 제한 키가 IP라 전체 상한은 코드에 없다. **전체 상한은 Anthropic 콘솔의 지출 한도뿐이며, 사용자가 둔다.**
- 020(contract-cleanup)이 `shared/api.ts`에 "다음 제공자(유료 Claude)"라는 옛 순서 기준 주석을 추가했다(1차 리뷰 #5, 병합 트리에서 확인). 020과 이 브랜치 중 나중에 병합되는 쪽이 순서 중립 문장으로 고친다. `worker/ai/textChain.ts:8`의 예시 값, `worker/ai/workersAiText.ts:42` 주석도 020과 겹치므로 020 병합 뒤 정리한다(1차 리뷰 #10).
- Claude의 한국어 품질 근거는 009 실측 2건뿐이다. 배포 후 확인에서 ko 응답을 한 번 더 본다.

## 배포 후 확인

사용자 확인 뒤 2026-10-20 15:03 KST(`wrangler deployments list` 기준 06:03:18Z)에 배포했다.

- 푸시: 배포 직전 `git fetch` 결과 `origin/main`이 이미 병합 커밋 `5299003`(022 포함)을 가리키고 있어 이 작업에서 따로 푸시할 커밋은 없었다.
- 배포: main 체크아웃(`5299003`, 깨끗함)에서 `npm run deploy`(= `npm run build && wrangler deploy`), 종료 코드 0. 출력의 바인딩 표에 `env.TEXT_PROVIDER ("claude,workers-ai")`, `env.AI_PROVIDER ("workers-ai")`. Current Version ID `43807d50-d216-4887-ab95-135dbc6b527a`.

배포 주소 `https://vocatype.hs827.workers.dev`에서 15:03 KST에 확인:

| 호출 | 결과 |
| --- | --- |
| `GET /api/config` | `{"provider":"workers-ai","textProviders":["claude","workers-ai"],"features":{"portrait":true,"reading":true}}` — **claude가 앞** (배포 직전에는 `["workers-ai","claude"]`) |
| `GET /api/health` | 200 |
| `POST /api/reading` ko `WFQV`(warmth 0.78 · density 0.86 · pace 0.71 · variation 0.64 · pitch 0.31 · brightness 0.42) | 200, 2.8초, **`provider: "claude"`**. 리딩 4문장 187자, 캡션 25자("듣는 이를 이야기 한가운데로 끌어당기는 목소리") |

- 출력 규칙 점검: 4문장 모두 해요체, "당신" 없음, 숫자·축 이름·타입 코드 인용 없음, 성별·나이가 실린 표현 없음, 캡션은 ko 28자 한도 안. 설계에서 "표본이 작다"고 한 Claude 한국어 품질의 세 번째 표본이다.
- 비용: 이 확인으로 Claude 1회(약 $0.0002)를 썼다. 초상은 호출하지 않았다.
- `wrangler tail`은 열지 않았다(응답의 `provider`로 충분했고 observability는 꺼져 있다).
