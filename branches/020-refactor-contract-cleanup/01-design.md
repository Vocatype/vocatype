# 020 refactor/contract-cleanup — 설계 문서

## 배경

2026-10-20 구조 리뷰(접속부터 호출까지)는 클라이언트(`src/`)·Worker(`worker/`)·공용 계약(`shared/`)의 층 나눔이 대체로 맞다고 봤다. 다만 한 규칙이 여러 곳에 따로 적혀 있거나 주석으로만 이어진 곳이 네 군데 있었다. 모두 심각도 낮음이며, 지금 동작은 맞지만 다음 변경 때 어긋나기 쉽다.

| # | 규칙 | 지금 정의된 곳 | 문제 |
| --- | --- | --- | --- |
| 1 | 지원 언어 | `src/i18n/locales.ts:1` `LOCALES`, `shared/api.ts:48` `ReadingLocale = 'ko' \| 'en'`, `shared/catalog.ts:3-6` `Localized { ko; en }`, `worker/reading.ts:19` `locale !== 'ko' && locale !== 'en'` | 네 곳이 타입으로 이어져 있지 않다. 특히 Worker 검증은 리터럴 비교라, 언어를 더하면 컴파일은 되는데 `/api/reading`이 400(`invalid_request`)을 돌려준다 |
| 2 | 리딩 시간 규칙 "클라이언트 대기 > Worker 체인 예산" | `src/features/ai/client.ts:19` `READING_TIMEOUT_MS = 30000`, `worker/ai/textChain.ts:74` `CHAIN_TIME_BUDGET_MS = 25_000`, `worker/ai/claude.ts:21` `TOTAL_TIMEOUT_MS = 25_000` | 관계는 주석으로만 이어져 있고, `client.ts:18` 주석은 이유를 "SDK 12초 × 2"로 잘못 적었다(실제 이유는 체인 예산). 예산 숫자는 두 곳에 따로 있다 |
| 2b | 체인 예산 신호 | `worker/ai/workersAiText.ts:47` | Workers AI 텍스트 제공자는 체인이 넘기는 `AbortSignal`을 받지 않는다. 주석(42행)은 "바인딩 호출 옵션에는 중단 신호가 없다"고 적었다 |
| 3 | 본문 크기 제한 읽기 | `worker/portrait.ts:9` `readBodyLimited` | 초상·리딩 공용 함수가 초상 파서 안에 있어 `worker/reading.ts`가 `./portrait.ts`를 import한다 |
| 4 | 녹음 지원 판정 | `src/screens/LandingScreen.tsx:16-21`, `src/features/recorder/recorderSupport.ts:47` `isRecordingSupported` | 같은 `getUserMedia`·`MediaRecorder` 검사가 두 벌 있다 |

## 목표

각 규칙의 출처를 한 곳으로 모으고, 나머지는 그 출처에서 타입·값을 끌어오거나 테스트로 관계를 고정한다. 사용자에게 보이는 동작과 API 계약(요청·응답 JSON)은 바뀌지 않는다. 유일한 의도된 동작 차이는 2b(아래)이며, 체인 예산을 넘긴 Workers AI 호출에서만 드러난다.

## 범위

### 포함

1. **언어 단일 출처** — `shared/locale.ts` 신설.
   - `LOCALES = ['ko', 'en'] as const`, `type Locale`, `isLocale(value: unknown): value is Locale`.
   - `shared/api.ts`: `ReadingLocale`을 지우고 `ReadingRequest.locale: Locale`. (`ReadingLocale`을 쓰던 `src/features/ai/client.ts`·`src/features/ai/reading.ts`는 `Locale`로.)
   - `shared/catalog.ts`: `Localized = Record<Locale, string>`.
   - `worker/reading.ts`: `isLocale(locale)`로 검증.
   - `src/i18n/locales.ts`: `LOCALES`·`Locale`을 다시 내보내고(`export { … } from`), 감지(`DEFAULT_LOCALE`, `detectLocale`, `detectBrowserLocale`)는 그대로 둔다. 기존 import 경로(`../i18n/locales`)는 하나도 바꾸지 않는다.
2. **리딩 시간 규칙** — `shared/api.ts`의 리딩 절에 두 상수.
   - `READING_CHAIN_BUDGET_MS = 25_000`: Worker 체인 전체(제공자 전부·재시도·대기 포함) 예산. `textChain.ts`의 기본 예산과 `claude.ts`의 자체 상한(체인 신호가 없을 때)이 이 값을 쓴다. `CHAIN_TIME_BUDGET_MS`·`TOTAL_TIMEOUT_MS`는 지운다.
   - `READING_CLIENT_TIMEOUT_MS = 30_000`: 클라이언트가 `/api/reading`을 기다리는 시간. `client.ts`의 지역 상수를 지운다.
   - 이유를 출처 한 곳(`shared/api.ts`)에 바르게 적는다: 체인이 예산 안에 답(최악이면 mock)을 돌려줘야 클라이언트가 포기한 뒤 유료 호출이 새로 나가지 않는다. 차이 5초는 네트워크 왕복과 Worker 처리 여유.
   - `client.ts:18`의 잘못된 주석("SDK 12초 × 2")을 고친다. `claude.ts`의 `REQUEST_TIMEOUT_MS` 주석도 "클라이언트 타임아웃(30초) 안에"에서 "두 번(12초 × 2 = 24초)이 체인 예산 안에, 전체 상한은 신호가 건다"로 정정한다.
3. **2b. Workers AI 텍스트 제공자가 체인 신호를 받는다** — `ai.run(model, inputs, { signal: options?.signal })`.
   - 확인 결과(구현 전 조사): 생성된 바인딩 타입(`worker-configuration.d.ts`의 `AiOptions`)에 `signal?: AbortSignal`이 001 이후로 줄곧 있었고, 로컬 런타임(workerd 1.20261012.1, wrangler 안의 1.20261019.1)에 내장된 `cloudflare-internal:ai-api` 구현이 `run()`의 `options.signal`을 바인딩 `fetch`의 `signal`로 넘기며(`#generateFetch`·스트림·웹소켓 세 경로 모두), 본문 `options`에서는 뺀다. 따라서 "바인딩이 신호를 받지 못한다"는 42행 주석이 틀렸다. 공식 문서의 `run()` 옵션 표에는 `signal`이 없어(문서는 `stream`만 나열), 근거는 타입과 런타임 소스로 적는다.
   - 동작 차이: 체인 예산(25초)을 넘기는 Workers AI 호출이 지금은 끝날 때까지 기다리고, 바뀐 뒤에는 25초에 끊기고 mock으로 간다. 남은 예산이 3초 미만이라 Claude는 어느 쪽이든 건너뛴다.
     - 25초를 넘겨 실패하는 호출: 사용자에게 보이는 결과(리딩 없음 → 카탈로그 설명)는 같고, Worker가 더 일찍 답한다.
     - 25~30초 사이에 정상 JSON으로 끝나는 호출: 지금은 체인이 성공을 예산과 상관없이 돌려주므로 클라이언트 대기(30초) 안이면 리딩이 보인다. 바뀐 뒤에는 25초에 끊겨 리딩이 사라진다(1차 리뷰 #1로 추가). Scout 실측(2~9초)으로는 드물고, "체인은 예산 안에 답한다"는 시간 규칙과 맞는 쪽이라 받아들인다.
     - 예산 안에서 끝나는 호출(실측 2~9초)은 그대로다.
   - 010 문서(`branches/010-feature-text-provider-chain/02-implementation.md`, `03-review.md`)의 "바인딩 호출 옵션에는 중단 신호가 없다"는 서술은 이 확인으로 대체한다(이력이라 고치지 않는다).
   - 신호를 끊은 뒤 Cloudflare 쪽 추론이 실제로 멈추는지(뉴런 과금)는 바인딩 밖이라 확인할 수 없다. Worker가 기다리지 않는다는 것까지만 보장한다.
4. **`readBodyLimited` 이동** — `worker/http.ts` 신설로 옮기고 `portrait.ts`·`reading.ts`가 각각 import. 함수 본문은 그대로.
5. **녹음 지원 판정 재사용** — `LandingScreen`의 `checkAvailability`가 보안 컨텍스트 검사 뒤 `isRecordingSupported()`를 부른다. 두 조건식은 드모르간으로 같은 식이다.

### 제외

- 초상 제공자(`worker/ai/workersAi.ts`)의 시간 상한. 지금 Worker 쪽 초상 호출에는 신호·타임아웃이 없고 클라이언트(60초)만 끊는다. 리딩과 달리 체인·유료 폴백이 없어 이번 정리의 규칙(클라이언트 > 체인 예산)과 관계가 없다. 후속 후보로 남긴다.
- 화면의 언어별 분기(`ResultScreen.tsx:77` `locale === 'ko' ? 'ko-KR' : 'en-US'`, `:180` 영어 소문자, `scripts.ts`의 `script.locale === 'ko'`). 언어를 더할 때 타입 오류가 나지 않는 곳이지만, 이번 범위(클라이언트↔Worker 계약)가 아니고 언어마다 규칙이 달라 기계적으로 묶을 수 없다. 후속 후보로 남긴다.
- `DEFAULT_LOCALE`을 shared로 옮기는 것. Worker는 기본 언어를 쓰지 않는다(모르는 언어는 거부).

## 구조

```
shared/locale.ts   LOCALES, Locale, isLocale            ← 언어의 단일 출처 (DOM 없음, 세 tsconfig 모두 포함)
  ├─ shared/api.ts       ReadingRequest.locale: Locale
  │                      READING_CHAIN_BUDGET_MS, READING_CLIENT_TIMEOUT_MS  ← 시간 규칙의 단일 출처
  ├─ shared/catalog.ts   Localized = Record<Locale, string>
  ├─ src/i18n/locales.ts 재수출 + 감지
  └─ worker/reading.ts   isLocale 검증

worker/http.ts     readBodyLimited                      ← portrait.ts, reading.ts 가 함께 쓴다
```

import 규칙은 지금 관례를 따른다: `shared/`·`worker/` 안에서는 `.ts` 확장자를 붙이고, `src/`에서 shared로 갈 때는 확장자 없이 쓴다.

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| `ReadingLocale`을 지우고 `Locale`을 그대로 쓴다 | 리딩 언어는 정의상 "생성 시점의 화면 언어"라 다른 집합이 될 이유가 없다. 별칭을 남기면 이름이 둘이 된다 |
| `isLocale`은 `unknown`을 받는다 | Worker 검증이 JSON에서 꺼낸 `unknown`을 바로 넘긴다. 감지 쪽(`detectLocale`)은 문자열을 넘기므로 그대로 쓸 수 있다 |
| 시간 상수는 `shared/api.ts`에 둔다(새 파일을 만들지 않는다) | 두 값은 `/api/reading` 계약의 일부이고 이미 같은 파일에 리딩 길이 범위 같은 "서버와 클라이언트가 함께 지키는" 상수가 있다 |
| 관계 테스트 두 겹: 상수 비교(`shared/api.test.ts`) + 클라이언트 동작(`client.test.ts`) | 상수 비교는 규칙을 문서처럼 못 박고, 동작 테스트는 클라이언트가 실제로 그 상수를 쓰는지(체인 예산이 지나도 기다리고, 클라이언트 시간이 지나면 끊는지)를 본다. 기존 `client.test.ts`의 `30_001` 리터럴도 상수로 바꾼다 |
| 여유(5초)는 테스트하지 않고 방향(>)만 검사한다 | 5초는 실측에서 나온 값이 아니라 판단이라, 임의의 하한을 테스트에 박으면 근거 없는 숫자가 하나 더 생긴다. 이유는 출처 주석에 적는다 |
| Workers AI 제공자는 체인 신호만 넘기고 자체 기본 상한은 두지 않는다 | 운영에서는 항상 체인을 거쳐 신호가 있다. 기본 상한을 새로 만들면 체인 밖 동작이 바뀐다(지금은 상한 없음) |
| 중단 오류를 Claude처럼 바꿔 던지지 않는다 | Claude는 SDK가 중단을 `APIUserAbortError`로만 알려 로그에서 이유를 알 수 없어 바꿔 던진다. 바인딩은 신호의 `TimeoutError`가 그대로 올라오므로 체인 로그(`workers-ai failed, falling back: TimeoutError: …`)로 충분하다 |
| `readBodyLimited`는 `worker/http.ts`로 | 요청 본문 읽기는 HTTP 공용 관심사다. `index.ts`의 `json()` 같은 다른 HTTP 도우미까지 옮기는 것은 범위 밖(리뷰가 지적한 의존 방향 하나만 고친다) |
| `checkAvailability`는 화면 안에 둔다 | 보안 컨텍스트 구분은 안내 문구 선택용이라 화면 관심사다. 녹음 가능 판정만 `recorderSupport`에서 가져온다 |

## 검증 계획

- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build` 종료 코드 0. 지금 기준 29 파일 193 테스트.
- 추가 테스트
  - `shared/locale.test.ts`: `isLocale`이 지원 언어만 받고 문자열이 아닌 값·대소문자 다른 값을 거부.
  - `shared/api.test.ts`: `READING_CLIENT_TIMEOUT_MS > READING_CHAIN_BUDGET_MS`.
  - `src/features/ai/client.test.ts`: 체인 예산이 지나도 요청을 끊지 않고 응답을 받는다 / 타임아웃 테스트의 리터럴을 상수로.
  - `worker/ai/workersAiText.test.ts`: 체인 신호가 `ai.run` 세 번째 인자로 그대로 간다, 신호가 없으면 `signal`이 없다.
  - `worker/http.test.ts`: `readBodyLimited` 직접 테스트(바이트 기준 제한, `content-length` 선언 초과, 본문 없음). `portrait.test.ts`의 같은 이름 describe는 `parsePortraitRequest` 쪽으로 정리.
  - `worker/reading.test.ts`: `LOCALES`의 모든 언어를 통과시키는지(언어를 더하면 자동으로 검사).
  - `src/features/recorder/recorderSupport.test.ts`: `isRecordingSupported`(전역 stub).
  - `src/screens/LandingScreen.test.tsx`: 세 상태(ok / insecure / unsupported)의 안내 문구와 시작 버튼 `disabled`를 정적 렌더로 확인. 바꾸기 전 코드에서도 같은 테스트가 통과하는지 먼저 본다(동작 불변의 근거).
- 회귀 감지(구현자 확인): Worker 검증을 옛 리터럴로 되돌리고 `LOCALES`에 임시 언어를 더하면 타입 검사가 어디서 실패하는지, 클라이언트 타임아웃을 25초로 내리면 관계 테스트가 실패하는지 한 번씩 본다.
