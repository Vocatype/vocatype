# 010 feature/text-provider-chain — 구현 문서

## 요약

009의 단일 선택 텍스트 제공자를 **폴백 체인**으로 바꿨다. `TEXT_PROVIDER` 콤마 목록(기본 `"workers-ai"`)을 순서대로 시도하고, 실패하면 다음으로, 모두 실패하면 모의 고정 문구(`provider: "mock"`)로 끝난다.
무료 Workers AI 텍스트 모델(`@cf/meta/llama-3.3-70b-instruct-fp8-fast`)이 먼저, Claude는 `ANTHROPIC_API_KEY`가 있을 때만 체인에 들어간다. 두 모델은 같은 프롬프트·같은 JSON 출력 계약을 쓰고, 출력 검증은 공용 모듈 한 곳에서 한다.
클라이언트는 `provider === 'mock'`을 "리딩 없음"으로 보고 카탈로그 설명으로 폴백한다. 서버로 가는 데이터(타입 코드·여섯 축·언어)와 개인정보 원칙은 009 그대로다.
리뷰 반영(`fix(reading): 010 리뷰 반영` 커밋)까지 포함한 상태를 기록한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `shared/api.ts` | `TextProviderName`에 `'workers-ai'`, `ApiConfigResponse.textProvider` → `textProviders: TextProviderName[]`(체인, 비어 있으면 꺼짐), `ReadingResponse.provider` 주석(실제 답한 제공자, 모두 실패면 `mock`) |
| `worker/ai/readingOutput.ts` | 공용 출력 검증 `normalizeReadingOutput`(형태·공백·길이), `parseReadingJson`(코드 펜스 제거 후 JSON 파싱) |
| `worker/ai/workersAiText.ts` | Workers AI 텍스트 제공자: 모델 상수, `messages`(같은 시스템·사용자 프롬프트) + `response_format: { type: 'json_schema', json_schema }` + `max_tokens: 1024`, 응답이 문자열이든 객체든 공용 검증, 토큰 수 로그 |
| `worker/ai/textChain.ts` | `parseTextProviderChain`(콤마·공백·대소문자·중복·모르는 값·mock 제외), `buildTextChain`(바인딩/키 조건), `createTextChain`(순서대로 시도, 체인 전체 25초 시간 예산, warn 로그, 모두 실패 시 error 로그 + mock), `selectTextChain`; `textSelect.ts` 삭제 |
| `worker/ai/types.ts` | `TextProvider.generateReading(input, { signal? })`로 확장(체인이 남은 예산을 넘김), 쓰이지 않는 `supportsReading` 제거 |
| `worker/ai/claude.ts` | 파싱을 공용 모듈로 위임(거부·잘림 검사는 유지), 체인이 준 신호를 우선 사용(없으면 자체 25초), 로그 접두에 `claude` |
| `worker/ai/textMock.ts` | 고정 문구를 체인 중립 문구로(사용자에게는 보이지 않음을 명시) |
| `worker/index.ts` | `/api/config`에 `textProviders`·`features.reading = 체인 비어 있지 않음`, `/api/reading`은 체인 호출. 503은 체인 밖 예외의 안전망으로만 |
| `wrangler.jsonc`, `worker-configuration.d.ts` | `vars.TEXT_PROVIDER = "workers-ai"`(키 없이 동작하는 기본값), 주석에 체인 설명. 타입 재생성 후 로컬 `.dev.vars`가 넓힌 리터럴·비밀 이름을 깨끗한 출력대로 복원 |
| `src/features/ai/client.ts` | `provider === 'mock'` → `null`, 오프라인 설정 `textProviders: []` |
| 테스트 | `worker/ai/textChain.test.ts`(설정 파싱 8, 체인 조립 5, 폴백 7 — 신호 전달·시간 예산 소진 포함, 모델 1), `worker/ai/workersAiText.test.ts`(입력 형태, 문자열/펜스/객체 응답, 형식 오류, 바인딩 오류 전파), `worker/index.test.ts`(체인 3건: 4006 → claude, workers-ai 성공 시 claude 미호출, 모두 실패 → mock; 기존 claude 실패 테스트는 200+mock으로), `src/features/ai/client.test.ts`(mock → null) |
| `README.md` | 텍스트 제공자 절을 체인 기준으로(설정 표, Claude 추가 절차, 무료 할당량 공용, 비용) |

## 주요 구현

- **체인 조립**: `TEXT_PROVIDER`를 콤마로 나눠 아는 이름(`workers-ai`, `claude`)만 순서대로 남긴다(중복은 처음 것, `mock`·모르는 값은 버림). `workers-ai`는 `env.AI` 바인딩이, `claude`는 공백을 뺀 `ANTHROPIC_API_KEY`가 있을 때만 들어간다. 빈 체인이면 `features.reading: false`라 클라이언트가 호출하지 않는다.
- **시간 예산**: 체인 전체 25초(`CHAIN_TIME_BUDGET_MS`, 클라이언트 30초보다 짧게). 제공자를 시도하기 전 남은 예산이 3초 미만이면 건너뛰고(`skipped: time budget exhausted` 로그) mock으로 끝낸다. 시도하는 제공자에는 남은 예산을 `AbortSignal.timeout`으로 넘기며 Claude가 이를 쓴다. Workers AI 바인딩 호출 옵션에는 중단 신호가 없어 끊을 수는 없지만, 그 호출이 오래 끌면 뒤의 유료 호출은 나가지 않는다.
- **폴백 실행**: 앞에서부터 `generateReading`을 호출하고 예외가 나면 `[reading] <name> failed, falling back: <ErrName>: <message>`를 warn으로 남기고 다음으로 간다. 모두 실패하면 `[reading] all providers failed (…), using mock`을 error로 남기고 모의 고정 문구를 `provider: 'mock'`으로 돌려준다. 로그에는 오류 이름·메시지만 들어가고 요청 본문·축 값은 없다(테스트가 단언). 체인은 던지지 않는다.
- **Workers AI 텍스트 제공자**: 생성 타입의 `Messages` 변형(`messages` + `response_format` + `max_tokens`)을 쓴다. JSON 모드 응답이 문자열이면 파싱(코드 펜스 허용), 객체면 그대로 검증한다. 길이·형태가 어긋나면 예외 → 다음 제공자. 할당량 소진 `AiError 4006`도 예외로 전파된다.
- **공용 출력 검증**: 리딩 20~600자, 캡션 2~100자, 공백 정리, 배열·비객체 거부. Claude 쪽은 거부(`refusal`)·잘림(`max_tokens`) 검사 뒤 같은 함수를 쓴다.
- **응답 계약**: `/api/reading`의 `provider`는 실제로 답한 제공자. `/api/config`의 `textProviders`는 체인 이름 배열(`mock` 제외).
- **클라이언트**: `provider === 'mock'`이면 리딩을 `null`로 처리해 결과 화면은 카탈로그 설명만 보인다. 그 밖(`workers-ai`, `claude`)은 동일하게 표시한다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 공용 파서 | + 코드 펜스(```json) 제거 | 일부 모델이 JSON을 펜스로 감싼다. Claude 구조화 출력에는 영향 없다. |
| 없음 | `worker-configuration.d.ts`에서 `ANTHROPIC_API_KEY: string` 제거 | 로컬 `.dev.vars`의 비밀 이름이 생성 파일에 들어갔다. 깨끗한 환경 출력에는 없으므로 되돌렸다(값은 어디에도 없음). |
| 체인에 시간 예산 없음 | 체인 전체 25초 예산 + 제공자에 남은 예산 신호 | 리뷰 #1. 앞 제공자 20초 + Claude 25초면 클라이언트가 포기한 뒤 유료 호출이 나간다. |
| Workers AI `max_tokens: 600` | 1024 | 리뷰 #3. 한글 3~4문장 JSON이 250~350토큰이라 여유를 두고, 잘려서 유료로 넘어가는 일을 줄인다. 실제 출력만 과금. |
| 제공자 이름 대소문자 구분 | 소문자로 정규화 | 리뷰 #4. 모르는 이름 경고 로그는 요청마다 찍혀 소음이라 넣지 않고, 적용된 체인을 `/api/config`로 확인하게 했다. |
| 초상 1장 "수백 뉴런", 8B "약 45뉴런" | 초상 약 1,400~1,500뉴런(하루 6~7장), 8B는 약 22뉴런 | 리뷰 #2. 가격표(타일당 636 + 스텝당 12, 8B 13,778/26,128 뉴런/M) 기준으로 README를 고쳤다. 70B 리딩 "약 70뉴런"은 맞다. |
| `TextProvider.supportsReading` | 제거 | 리뷰 #6. 체인에서 쓰이지 않는 죽은 필드. `TextChain.supportsReading`은 라우트가 쓰므로 유지. |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 (`Env.TEXT_PROVIDER: "workers-ai"`) |
| 린트 | `npm run lint` | 경고 0, 오류 0 |
| 단위 테스트 | `npm test` | 27 파일 173 테스트 통과 (009 대비 +17) |
| 빌드 | `npm run build` | 통과. Worker 번들 약 855KB(gzip 174KB). 출력 `wrangler.json`에 `vars.TEXT_PROVIDER = "workers-ai"` |
| 체인 실제 동작 (workerd) | `wrangler dev -c dist/worker/wrangler.json --port 8788 --var TEXT_PROVIDER:workers-ai,claude` (키는 빌드가 복사한 로컬 `.dev.vars`에서) | `/api/config` → `textProviders: ["workers-ai","claude"]`, `reading: true`. `POST /api/reading` ko(`WLMV`) → 200 `provider: "claude"` 3.5초, en(`CFQV`) → 200 `provider: "claude"`. 로그: `[reading] workers-ai failed, falling back: AiError: 4006: you have used up your daily free allocation of 10,000 neurons …` → `[reading] claude claude-haiku-5-5 in=1217 out=264 stop=end_turn`(ko), `in=1193 out=180`(en). **4006 폴백 경로가 실제로 동작함을 확인.** |
| Workers AI 모델의 실제 출력 품질 | — | 오늘 무료 할당량이 소진된 상태(초상 생성이 먼저 소진)라 Llama 응답은 받지 못했다. 할당량이 초기화된 뒤 `provider: "workers-ai"` 응답의 한국어 품질을 확인해야 한다(README 배포 후 확인 절차). |

## 알려진 한계

- Llama 3.3 70B의 한국어 리딩 품질은 아직 실측하지 못했다. 품질이 낮으면 상수를 다른 모델로 바꾸거나 체인 순서를 `claude,workers-ai`로 뒤집을 수 있다(설정만 변경).
- 무료 할당량은 초상과 리딩이 함께 쓴다. 초상 1장이 리딩 수 회분을 쓰므로 하루 중 이른 시점부터 리딩이 Claude로 넘어갈 수 있다. 체인에 Claude가 없으면(기본값) 그때부터 리딩은 보이지 않는다(카탈로그 설명으로 폴백).
