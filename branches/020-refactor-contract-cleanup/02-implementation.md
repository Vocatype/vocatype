# 020 refactor/contract-cleanup — 구현 문서

## 요약

설계의 네 가지 정리를 구현 커밋 넷(설계 문서 커밋 별도)으로 나눠 넣었다. 언어 목록·리딩 시간 규칙은 `shared/` 한 곳에서 정하고 나머지는 거기서 타입·값을 가져오며, 관계는 테스트로 고정했다. `readBodyLimited`는 `worker/http.ts`로 옮겼고, 메인 화면은 녹음 훅과 같은 `isRecordingSupported()`를 쓴다.
요청·응답 JSON과 화면 동작은 그대로다. 의도된 동작 차이는 하나뿐이다. Workers AI 텍스트 호출이 체인 예산(25초)을 넘기면 이제 25초에 끊긴다(설계 3번 항목). 25~30초 사이에 성공했을 호출도 이제 mock이 된다(드묾, 1차 리뷰 #1). 테스트 파일 29 → 33, 테스트 193 → 214.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `shared/locale.ts` | 신설. `LOCALES`, `Locale`, `isLocale(value: unknown)` |
| `shared/locale.test.ts` | 신설. 지원 언어 통과, `xx`·`KO`·`ko-KR`·빈 문자열·`undefined`·`null`·배열 거부 |
| `shared/api.ts` | `ReadingLocale` 제거, `ReadingRequest.locale: Locale`. 리딩 시간 규칙 주석과 `READING_CHAIN_BUDGET_MS = 25_000`, `READING_CLIENT_TIMEOUT_MS = 30_000` |
| `shared/api.test.ts` | 신설. `READING_CLIENT_TIMEOUT_MS > READING_CHAIN_BUDGET_MS` |
| `shared/catalog.ts` | `Localized = Record<Locale, string>`(interface → type) |
| `src/i18n/locales.ts` | `LOCALES`·`Locale` 재수출, `isLocale`은 shared 것을 씀. 감지 함수는 그대로 |
| `src/features/ai/client.ts` | `ReadingLocale` → `Locale`, 지역 상수 `READING_TIMEOUT_MS`와 잘못된 근거 주석 제거, `READING_CLIENT_TIMEOUT_MS` 사용 |
| `src/features/ai/client.test.ts` | 타임아웃 테스트의 `30_001` → `READING_CLIENT_TIMEOUT_MS + 1`. "체인 예산이 다 지나도 아직 기다린다" 추가 |
| `src/features/ai/reading.ts` | `visibleReading(…, locale: Locale)` |
| `worker/reading.ts` | `isLocale(locale)`로 검증, `readBodyLimited`는 `./http.ts`에서 |
| `worker/reading.test.ts` | `LOCALES` 전부 통과, `KO`·숫자 로케일 거부. 지원하지 않는 언어 예시는 `'ja'` → `'xx'`(1차 리뷰 #5) |
| `worker/ai/textChain.ts` | `CHAIN_TIME_BUDGET_MS` 제거, 기본 예산은 `READING_CHAIN_BUDGET_MS` |
| `worker/ai/textChain.test.ts` | import 를 shared 상수로 |
| `worker/ai/claude.ts` | `TOTAL_TIMEOUT_MS` 제거, 신호가 없을 때 상한은 `READING_CHAIN_BUDGET_MS`. `REQUEST_TIMEOUT_MS` 주석 정정(12초 × 2 = 24초가 체인 예산을 넘지 않게, 실제 상한은 신호) |
| `worker/ai/claude.test.ts` | 신호가 없으면 `AbortSignal.timeout(READING_CHAIN_BUDGET_MS)`를 한 번 걸고, 체인 신호가 있으면 그것을 그대로 씀(1차 리뷰 #3) |
| `worker/ai/workersAiText.ts` | `generateReading(input, options)`가 `ai.run(model, inputs, { signal: options?.signal })`. 신호를 받지 못한다던 주석을 확인 근거로 교체 |
| `worker/ai/workersAiText.test.ts` | 신호가 바인딩 옵션으로 그대로 가고, 없으면 `signal`이 없음 |
| `worker/ai/types.ts` | `GenerateOptions.signal` 주석: 두 제공자 모두 쓴다 |
| `worker/http.ts` | 신설. `readBodyLimited`(본문은 `portrait.ts`에서 그대로 옮김) |
| `worker/http.test.ts` | 신설. 7개(아래) |
| `worker/portrait.ts` | `readBodyLimited` 정의 제거, `./http.ts`에서 import |
| `worker/portrait.test.ts` | `describe('readBodyLimited')`(실제로는 `parsePortraitRequest`를 부르던 두 테스트)를 `parsePortraitRequest`로 합침 |
| `src/screens/LandingScreen.tsx` | `checkAvailability`가 보안 컨텍스트 검사 뒤 `isRecordingSupported()` |
| `src/screens/LandingScreen.test.tsx` | 신설. 5개(ok 1, insecure 2, unsupported 2) |
| `src/features/recorder/recorderSupport.test.ts` | `isRecordingSupported` 2개 |
| `README.md` | 텍스트 제공자 절에 시간 예산 한 줄(25초 예산, 두 제공자 모두 신호, 클라이언트 30초) |

## 커밋

| 커밋 | 내용 |
| --- | --- |
| `c4ab010` | 설계 문서 |
| `b10cf3d` | 언어 단일 출처 |
| `59b0d57` | 리딩 시간 규칙 + Workers AI 신호 |
| `a126318` | `readBodyLimited` 이동 |
| `06dc414` | 메인 화면 녹음 지원 판정 재사용 |
| `d75c538` | 구현 문서, README |
| (1차 반영) | 리뷰 문서와 1차 리뷰 반영(테스트 2개, 언어 예시, 문서 정정) |

## 주요 구현 내용

### 1. 언어 단일 출처

`src/`는 기존처럼 `../i18n/locales`에서 `Locale`을 가져온다(경로 변경 0건). `shared/`·`worker/`는 `shared/locale.ts`를 직접 쓴다. 임시로 `LOCALES`에 `'ja'`를 더해 타입 검사가 어디서 실패하는지 확인했다(아래 검증 표). 카탈로그 문구 77곳, 화면 사전 묶음, 언어 버튼 문구 키, 축 범위, Worker 프롬프트의 언어 이름, mock 고정 문구가 모두 오류로 드러나고, Worker 검증은 같은 목록을 써서 따로 고칠 곳이 없다. 바꾸기 전에는 Worker 검증이 `'ko'`/`'en'` 리터럴 비교라 컴파일은 통과하고 요청만 400이 됐다.

### 2. 리딩 시간 규칙

규칙과 이유는 `shared/api.ts`의 주석 한 곳에만 적고, 쓰는 곳(`client.ts`, `textChain.ts`의 `timeBudgetMs`)에는 "shared/api.ts의 리딩 시간 규칙"으로 가리키기만 했다.
테스트는 두 겹이다. 상수 비교는 규칙을 못 박고, 클라이언트 동작 테스트는 가짜 타이머로 `READING_CHAIN_BUDGET_MS + 1`ms를 흘린 뒤 fetch 신호가 아직 끊기지 않았고 그때 온 응답을 받아 쓰는지 본다. 클라이언트 타임아웃을 25초로 내리면 두 테스트가 모두 실패한다.

### 3. Workers AI 텍스트 제공자의 신호

설계 문서 3번 항목의 조사대로 바인딩 타입과 런타임 구현이 `signal`을 받는다. 확인한 런타임 소스(`cloudflare-internal:ai-api`, workerd 바이너리에 내장된 JS)에서 `run()`은 `options.signal`을 추론 요청 `fetch`에 넘기고, 본문 `options`에서는 `prefix`·`extraHeaders`·`sessionOptions`와 함께 뺀다. 그래서 신호가 없을 때 `{ signal: undefined }`를 넘겨도 본문은 옵션을 생략했을 때와 같은 `{}`이다.
중단되면 신호의 `TimeoutError`가 그대로 올라오고 체인 로그에 `workers-ai failed, falling back: TimeoutError: …`로 남는다. Claude처럼 바꿔 던지지 않았다(설계 결정 표). 1차 리뷰가 workerd를 직접 띄워 서비스 바인딩 `fetch`에 `AbortSignal.timeout(500)`을 걸면 507ms 뒤 이 `TimeoutError`로 reject됨을 확인했다.
010 문서의 "바인딩 호출 옵션에는 중단 신호가 없다"는 서술은 이 확인으로 대체한다(이력이라 고치지 않는다).

### 4. `readBodyLimited` 이동

함수 본문은 한 글자도 바꾸지 않았다(`git diff`에서 삭제 블록과 추가 블록이 같다). `http.test.ts`는 함수를 직접 부른다.

| 테스트 | 확인하는 것 |
| --- | --- |
| 제한 이하 본문은 UTF-8 문자열로 읽는다 | 한글이 든 본문이 그대로 돌아온다 |
| 정확히 최대 바이트까지는 받고 1바이트라도 넘으면 null | 1024바이트 통과, 1025바이트 `null`(1차 리뷰 #4) |
| 글자 수가 아니라 바이트로 센다 | `'가'` 341개(1023바이트) 통과, 342개(1026바이트) `null` |
| 본문이 없으면 빈 문자열 | `body: null` → `''` |
| 선언된 content-length 가 제한을 넘으면 본문을 읽지 않고 null | `body` 접근 시 던지는 가짜 요청으로 읽지 않음을 확인 |
| 길이 선언 없이 조각으로 와도 제한을 넘는 순간 스트림을 취소하고 null | 600바이트 × 3 스트림, `cancel` 호출됨 |
| 조각으로 온 본문을 이어 붙여 읽는다 | 두 조각 → 원래 문자열 |

### 5. 메인 화면 녹음 지원 판정

`LandingScreen.test.tsx`를 **바꾸기 전 코드에서 먼저 실행**해 5개 모두 통과함을 보고(15/15, 같은 실행에 recorderSupport 포함), 바꾼 뒤에도 같은 15개가 통과했다. 이것이 "동작 불변"의 근거다. 실제 브라우저는 보안 컨텍스트가 아니면 `navigator.mediaDevices` 자체가 없으므로, 그 조합에서 미지원이 아니라 HTTPS 안내가 나오는지도 검사한다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| `workersAiText.test.ts`: 신호 전달, 신호 없음 | 같음. 한때 "신호가 끊기면 중단 오류가 전파된다" 테스트도 넣었다가 뺐다 | 그 테스트는 가짜 `ai.run`의 동작을 검사할 뿐이고, 오류 전파는 기존 "바인딩 오류는 그대로 전파된다"가 이미 본다 |
| `README.md` 언급 없음 | 텍스트 제공자 절에 시간 예산 한 줄 추가 | 체인 설명에 예산·신호가 빠져 있었고, 상수 위치를 찾을 곳이 필요했다 |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 단위 테스트 | `npm test` | 33 파일 214 테스트 통과, 종료 코드 0(1차 리뷰 전 212) |
| 타입 검사 | `npm run typecheck` | 종료 코드 0 |
| 린트 | `npm run lint` | 종료 코드 0, 출력 없음 |
| 빌드 | `npm run build` | 종료 코드 0 |
| 동작 불변 (구현자 확인) | 바꾸기 전 코드에서 `LandingScreen.test.tsx` + `recorderSupport.test.ts` | 15/15 통과 → 바꾼 뒤 15/15 |
| 회귀 감지 (구현자 확인) | `LOCALES`에 `'ja'` 임시 추가 후 `tsc -p tsconfig.app.json` / `tsconfig.worker.json` | app: `shared/catalog.ts` 77, `src/i18n/messages/index.ts` 1, `src/components/TopBar.tsx` 1(`locale.ja` 문구 키), `src/features/analysis/axes.ts` 1 / worker: `shared/catalog.ts` 77, `worker/ai/readingPrompt.ts` 1, `worker/ai/textMock.ts` 1. 복원 확인 |
| 회귀 감지 (구현자 확인) | `READING_CLIENT_TIMEOUT_MS`를 25_000으로 | 2개 실패: 관계 테스트(`expected 25000 to be greater than 25000`), 클라이언트 대기 테스트(`signal.aborted` true). 복원 확인 |
| 로컬 Worker (구현자 확인) | dev 서버에 `curl` | `/api/reading` `locale: "ja"`·`"KO"` → 400 `invalid_request`, 한글 1.2KB 본문 → 413 `too_large`(리딩·초상 둘 다), `/api/config` 200. AI 호출이 나가지 않는 경로만 썼다 |
| 브라우저 (구현자 확인) | dev 서버 메인 화면 | localhost(보안 컨텍스트)에서 시작 버튼 활성, 안내 `landing__hint`(경고 없음), 한국어 → English 전환 후 영어 안내, 콘솔 오류 없음 |

확인하지 못한 것: 운영 Worker에서 Workers AI 호출이 25초에 실제로 끊기는지(정상 호출은 2~9초라 일부러 재현하기 어렵고 무료 할당량을 쓴다). 근거는 바인딩 타입과 로컬 런타임 소스다.

## 병합 순서 주의

`refactor/021-generation-orchestration`(형제 세션)의 `src/features/ai/generate.ts`·`generate.test.ts`가 이 브랜치에서 지운 `ReadingLocale`을 `shared/api`에서 import한다. 글자 충돌은 없지만 둘을 합치면 타입 검사가 TS2305로 실패한다(1차 리뷰 #2, 임시 병합 트리로 확인). 나중에 병합하는 쪽에서 `ReadingLocale`을 `Locale`(`src/`에서는 `../../i18n/locales`)로 바꾼다. 018·019는 영향 없음.

## 후속 후보

- 초상 Worker 호출(`worker/ai/workersAi.ts`)에 시간 상한이 없다. 클라이언트(60초)만 끊는다.
- 화면의 언어별 분기(`ResultScreen.tsx`의 날짜 로캘 `'ko-KR' : 'en-US'`, 영어 소문자 규칙, `scripts.ts`의 `script.locale === 'ko'`)는 언어를 더해도 타입 오류가 나지 않는다.
- `src/features/analysis/axes.ts:70`의 `options.locale ?? 'en'`은 `DEFAULT_LOCALE`로 바꿀 수 있다(1차 리뷰).
- Claude의 "12초 × 2 ≤ 체인 예산" 관계는 주석으로만 있다. `REQUEST_TIMEOUT_MS`를 내보내면 상수 관계 테스트로 올릴 수 있다(1차 리뷰).
- 화면 감지 테스트(`src/i18n/locales.test.ts`)는 지원하지 않는 언어 예시로 실제 브라우저 값 `ja-JP`를 쓴다. 일본어를 더하면 의도대로 깨지는 곳이라 그대로 뒀다.
