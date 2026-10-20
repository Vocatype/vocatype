# 009 feature/voice-reading — 구현 문서

## 요약

Worker에 **텍스트 제공자** 어댑터(`TextProvider`)를 추가하고, Claude API(`@anthropic-ai/sdk` 0.135, 기본 모델 `claude-haiku-5-5`)로 결과 화면의 "목소리 리딩" 문단(3~4문장)과 공유용 캡션 한 줄을 ko/en으로 만든다.
새 라우트 `POST /api/reading`은 `/api/portrait`와 같은 보호(교차 사이트 403, IP당 1분 5회 429, 1KB 413, 검증 400, 제공자 실패 503)를 받고, 입력은 **타입 코드·여섯 축(0..1, 소수 둘째 자리)·언어**뿐이다.
클라이언트는 초상 요청과 병렬로 호출하고 실패하면 카탈로그 설명으로 폴백한다. 초상 경로(Workers AI)는 건드리지 않았다.
1차 리뷰 반영(`fix(reading)` 커밋)까지 포함한 상태를 기록한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `package.json`, `package-lock.json` | `@anthropic-ai/sdk` 의존성 추가 |
| `shared/api.ts` | `TextProviderName`, `ReadingRequest`/`ReadingResponse`, `READING_AXIS_KEYS`, 길이 상한(리딩 20~600자, 캡션 2~100자), 1KB 제한. `ApiConfigResponse`에 `textProvider`·`features.reading` |
| `worker/ai/types.ts` | `TextProvider { name, supportsReading, generateReading(input) }`, `ReadingInput`/`ReadingOutput` |
| `worker/ai/textMock.ts` | 고정 문구 모의 제공자(`supportsReading: false`) |
| `worker/ai/readingPrompt.ts` | 고정 시스템 프롬프트(금지 사항 포함), 사용자 메시지 생성, JSON 출력 스키마 |
| `worker/ai/claude.ts` | Claude 제공자: 요청 파라미터(`output_config.format` JSON 스키마, `effort: 'low'`, `max_tokens: 4096`), 응답 파싱·검증(거부·잘림·형식·길이), 모델 이름 검증, SDK 타임아웃 12초·재시도 1 + 전체 25초 `AbortSignal` |
| `worker/ai/textSelect.ts` | `TEXT_PROVIDER`·`ANTHROPIC_API_KEY`·`TEXT_MODEL`로 제공자 선택 |
| `worker/reading.ts` | 요청 검증(타입 코드, 여섯 축 0..1 유한수 → 반올림, 로케일 ko/en, 추가 필드 제거), 1KB 바이트 제한(`readBodyLimited` 재사용) |
| `worker/index.ts` | `POST /api/reading`, `/api/config`에 텍스트 제공자 정보, 속도 제한 함수가 바인딩을 인자로 받도록 정리(`limiterOf`) |
| `wrangler.jsonc`, `worker-configuration.d.ts` | `vars.TEXT_PROVIDER = "mock"`, `ratelimits` `READING_LIMITER`(namespace 1002, IP당 1분 5회), 타입 재생성 |
| `src/features/ai/client.ts` | `requestReading`(타임아웃 30초, 실패·이상 응답 시 `null`, 공백 정리·길이 검증), `toReadingAxes`(0..1 클램프·반올림), `VoiceReading { locale, reading, caption }`, 오프라인 설정에 `reading: false` |
| `src/features/ai/reading.ts` | 순수 함수 `planGeneration`(켜진 기능·첫 단계, 저신호 녹음은 리딩 생략), `visibleReading`(언어 일치 규칙) |
| `src/screens/GeneratingScreen.tsx` | 설정 조회 뒤 초상·리딩을 `Promise.all`로 병렬 요청, 리딩 전용 단계 문구(초상이 먼저 끝나면 리딩 문구로 전환), `onGenerated({ profile, portrait, reading })` |
| `src/App.tsx` | `reading` 상태(메인 복귀·새 녹음 시 초기화) |
| `src/screens/ResultScreen.tsx` | 초상 카드 아래 리딩 카드(문단·캡션·안내), 생성 시점 언어와 다르면 숨김, 저장 이미지 캐시 키·캡션 전달, 공유 시트 본문에 캡션 |
| `src/features/export/renderCard.ts`, `save.ts` | `CardLabels.caption` 한 줄(26px/600, 말줄임, 이탤릭 없음), 세로 예산 회수(초상 400→380, 서명 반지름 110→100, 여백 48→40), `shareBlob(…, text)` |
| `src/i18n/messages/{ko,en}.ts`, `src/styles/global.css` | 단계 문구, 리딩 카드 제목·안내, 카드 스타일 |
| 테스트 | `worker/ai/textSelect.test.ts`, `readingPrompt.test.ts`, `claude.test.ts`, `worker/reading.test.ts`, `worker/index.test.ts`(리딩 라우트 5건: mock·400·413·405, 403·429·별도 제한, SDK 경유 실제 호출 형태, 실패·거부 503, 키 없음), `src/features/ai/client.test.ts`(축 반올림, 전송 본문, 폴백, 타임아웃), `src/features/ai/reading.test.ts`(요청 계획·저신호 생략·언어 규칙), `renderCard.test.ts`(캡션 위치·생략·말줄임, 최악 조합 예산) |
| `README.md` | 텍스트 제공자 절(켜는 방법, effort 지원 모델 안내, 보내는 데이터·Anthropic 데이터 정책, 비용), 개인정보 원칙, 알려진 한계 |

## 주요 구현

- **어댑터 경계**: `TextProvider`는 `AiProvider`와 별도다. `/api/config`가 `textProvider`와 `features.reading`을 알리고, 클라이언트는 `features.reading`이 true일 때만 `/api/reading`을 부른다. 모의 제공자는 `supportsReading: false`라 운영 기본값(mock)에서 사용자에게 고정 문구가 보이지 않으며, 라우트는 고정 문구를 돌려줘 로컬·테스트에서 쓸 수 있다.
- **제공자 선택**: `TEXT_PROVIDER === 'claude'`이고 `ANTHROPIC_API_KEY`(공백 제거 후 비어 있지 않음)가 있을 때만 Claude. 키는 `wrangler secret put`으로만 넣고 저장소·설정 파일에는 두지 않는다. 모델은 `TEXT_MODEL`이 `claude-`로 시작하는 식별자일 때만 쓰고 아니면 기본 모델이다.
- **프롬프트**: 시스템 프롬프트는 고정 영어 문자열이다. 역할·형식(3~4문장, 2인칭, 캡션 한 줄 ko 28자/en 60자 — 저장 카드 한 줄 폭 기준)과 함께 성별·나이·인종·국적·억양·외모·신체·건강·감정 상태 추정 금지, 성별·나이가 실린 단어(manly, feminine, 소녀, 어른스러운 …) 금지, "음높이·온기는 그 사람이 누구인지 말해 주지 않는다", 진단·조언 금지, 수치·축 이름·타입 코드를 그대로 말하지 말되 성질을 자기 말로 묘사하는 것은 허용, 호칭 금지, 한국어는 해요체에 주어 생략 또는 "목소리"를 주어로(당신 반복 금지)를 넣었다. 사용자 메시지는 출력 언어, 타입 이름(요청 언어·영어), 네 축 글자 뜻, 타입 설명(분위기 참고용), 여섯 축 수치(소수 둘째 자리)와 뜻만 담는다. 타입 코드 자체는 넣지 않는다.
- **Claude 호출**: `client.messages.create({ model, max_tokens: 4096, system, messages, output_config: { effort: 'low', format: { type: 'json_schema', schema } } }, { signal: AbortSignal.timeout(25_000) })`. Haiku 5.5는 적응형 사고가 기본이라 사고 토큰이 `max_tokens`에 포함되므로 넉넉히 두고(쓴 토큰만 과금), 샘플링 파라미터·프리필은 보내지 않는다(5.x에서 400). SDK는 요청당 12초 타임아웃·재시도 1회이며, 서버가 준 `retry-after`를 그대로 기다리므로 전체 25초 `AbortSignal`로 클라이언트가 포기한 뒤 두 번째 호출이 나가지 않게 한다(대기 중에는 신호를 보지 않아 Worker가 최대 대기 시간만큼 더 살아 있을 수는 있지만 추가 요청은 없다). 응답은 `stop_reason === 'refusal'`이면 실패(카테고리만 로그), `max_tokens`면 잘림 실패, 텍스트 블록을 `type`으로 골라(thinking 블록이 앞에 올 수 있음) JSON 파싱, 공백 정리 후 길이 검증. SDK 클라이언트는 요청마다 만든다(Workers는 전역 I/O 객체를 금지).
- **요청 검증**: 본문은 바이트 기준 1KB까지만 읽는다. 타입 코드 16개 중 하나, 로케일 ko/en, 여섯 축 모두 0..1 유한수여야 하고 서버가 소수 둘째 자리로 다시 반올림한다. 추가 필드는 버린다.
- **남용 방지**: `READING_LIMITER`(IP당 1분 5회, fail-open)를 초상 제한과 따로 둔다. 한 번의 생성에서 두 요청이 같이 나가므로 공유하면 초상 한도가 절반이 된다. 교차 사이트(`Sec-Fetch-Site`) 403은 초상과 같다.
- **클라이언트 흐름**: 설정 조회 → 분석 → `planGeneration(features, quality)` → `Promise.all([초상, 리딩])`. 목소리가 거의 잡히지 않은 녹음(`low-signal`, 여섯 축 모두 0.5)은 리딩을 요청하지 않는다(의미 없는 글과 비용을 피한다). 초상이 켜져 있으면 단계 문구는 "초상을 그리는 중", 리딩만 켜져 있으면 "목소리를 읽는 중"(둘 다 indeterminate)이고, 초상이 먼저 끝났는데 리딩을 아직 기다리면 리딩 문구로 바꾼다. 리딩 요청의 언어는 요청 시점의 화면 언어(`localeRef`)다. 어느 쪽이 실패해도 `null`로 받아 결과로 진행한다.
- **결과 화면**: `reading.locale === locale`일 때만 초상 카드 아래에 리딩 카드(문단, 강조색 캡션, "AI가 타입과 여섯 축 수치만 보고 쓴 글" 안내)를 그린다. 언어를 바꾸면 카드가 사라지고 카탈로그 설명만 남는다. 저장 이미지 캐시 키에 캡션을 넣어 언어 전환 시 다시 그린다. 공유 시트 `text`에 캡션을 넣는다.
- **저장 이미지**: 설명 아래에 캡션 한 줄(26px/600, 말줄임; 한글 글꼴에 이탤릭이 없어 기울임은 쓰지 않는다)을 넣었다. 한 줄에 한글 약 33자·영문 약 60자가 들어가므로 프롬프트의 캡션 상한을 ko 28자/en 60자로 맞췄다. 세로 예산(FOOTER_TOP 1800)을 지키기 위해 초상 400→380, 서명 반지름 110→100, 서명 아래 여백 48→40으로 48px를 회수했다. 최악 조합(이름 2줄·설명 3줄·캡션 꽉 참·향 2줄·통계 2줄·궁합 2행) 테스트가 1800 안에서 끝남을 확인한다. 캡션이 없으면 그 자리를 비운다(예전과 같은 배치에서 48px 여유가 생긴다).
- **개인정보**: 서버로 가는 것은 타입 코드·여섯 축·언어뿐이다. Anthropic에는 이 값을 적은 영어 프롬프트만 가고, 요청은 Worker가 보내므로 사용자 IP·UA는 가지 않는다(`metadata` 없음). 라우트 테스트가 SDK 경유 실제 요청 본문에 IP·UA·씨앗이 없음을 단언한다. 생성된 글은 응답으로만 돌아가고 저장하지 않는다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 사용자 메시지에 타입 코드 포함 | 타입 이름과 글자 뜻만 | 시스템 프롬프트가 코드 인용을 금지하므로 애초에 주지 않는 편이 낫다. |
| 언급 없음 | 공유 시트 `text`에 캡션 | "공유용 캡션"의 가장 자연스러운 쓰임. `shareBlob`에 선택 인자 추가. |
| 언급 없음 | 세로 예산 회수(초상 380, 서명 100, 여백 40) | 최악 조합이 이미 1780까지 써서 캡션 44px이 들어갈 자리가 없었다. |
| `.dev.vars` 언급만 | 빌드 출력 `dist/worker/.dev.vars` | Vite Cloudflare 플러그인이 로컬 미리보기용으로 복사한다(기존 동작). `dist`는 gitignore, `wrangler deploy`는 올리지 않는다. |
| `max_tokens` 1024 | 4096 | 1차 리뷰 #2. 사고 토큰이 포함되므로 잘림 → 조용한 폴백을 피한다. |
| SDK 타임아웃 12초 × 2 ≤ 30초 | 전체 25초 `AbortSignal` 추가 | 1차 리뷰 #3. SDK가 `retry-after`를 그대로 기다리면 계산이 깨진다. |
| 캡션 상한 ko 40 / en 80 | ko 28 / en 60 | 1차 리뷰 #1. 저장 카드 한 줄 폭. |
| 리딩 요청 조건 `features.reading` | + `quality !== 'low-signal'` | 1차 리뷰 #8. |
| `wrangler types` 출력 그대로 | `AI_PROVIDER: "workers-ai"` 리터럴 복원 | 1차 리뷰 #10. 로컬 `.dev.vars`에 같은 이름이 있으면 `string`으로 넓어진다. 깨끗한 환경의 출력과 같게 되돌렸다. |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 (`wrangler types` 재생성: `Env.TEXT_PROVIDER: "mock"`, `Env.READING_LIMITER: RateLimit`) |
| 린트 | `npm run lint` | 경고 0, 오류 0 |
| 단위 테스트 | `npm test` | 26 파일 156 테스트 통과 (기존 121 → +35). 2차 반영 뒤 토큰 로그 추가에 맞춰 가짜 응답에 `usage` 필드 보강 |
| 빌드 | `npm run build` | 통과. Worker 번들 849KB(gzip 172KB, SDK 포함; 006 대비 약 +800KB). 출력 `wrangler.json`에 `vars.TEXT_PROVIDER`, `ratelimits` 2개, `compatibility_flags` 없음 |
| API (개발 서버, mock) | `curl` | `GET /api/config` → `textProvider: "mock"`, `features.reading: false`; `POST /api/reading` ko/en 고정 문구 200; 축 1.5 → 400; 로케일 `ja` → 400; 2KB → 413; `sec-fetch-site: cross-site` → 403; `GET` → 405 `Allow: POST`; 같은 IP 3번째부터 429(로컬 에뮬레이션, 앞 2회 포함 5회 초과); 리딩이 429인 상태에서 `/api/portrait`는 429가 아님(별도 바인딩) |
| 전체 흐름 (mock) | 브라우저, 합성 오실레이터 스트림으로 `getUserMedia` 대체 | 녹음 → 생성 → 결과 도달. `/api/config` 1회, `/api/portrait` 1회(Workers AI 무료 할당량 소진 4006 → 503 → 자리표시), `/api/reading` 호출 없음, 리딩 카드 없음 |
| 전체 흐름 (리딩 켜짐 모의) | 브라우저, `fetch` 가로채기로 `reading: true`·1.5초 뒤 샘플 응답 | 결과에 "목소리 리딩" 카드(문단 4문장, 캡션, 안내)가 초상 카드 아래 표시. 요청 본문은 `{"typeCode":"CFQE","axes":{"warmth":0.11,"density":1,"pace":0.54,"variation":0.18,"pitch":0.73,"brightness":1},"locale":"ko"}` 뿐. English로 바꾸면 카드가 사라지고 영어 카탈로그 설명만, 한국어로 되돌리면 카드 복귀 |
| 단계 문구 전환 (1차 반영 후) | 브라우저, 초상 0.4초 뒤 503·리딩 3초 뒤 응답으로 가로채기 | 단계 문구가 "초상을 그리는 중 (조금 걸려요)" → "목소리를 읽는 중" 순으로 바뀌고 결과에 리딩 카드와 자리표시 초상 표시 |
| workerd에서 Claude 경로 실행 | `wrangler dev -c dist/worker/wrangler.json --port 8788 --var TEXT_PROVIDER:claude --var ANTHROPIC_API_KEY:<가짜 키>` | 빌드된 번들이 workerd에서 로드됨(`node:` 지정자 오류 없음, `nodejs_compat` 불필요). `/api/config` → `textProvider: "claude"`, `reading: true`; `POST /api/reading` → SDK가 Anthropic을 호출해 401(`invalid x-api-key`) → 503 `provider_failed`, 396ms. 로그 `[reading] provider failed: Error: 401 {…}`에 키 없음 |
| 실제 Claude 호출 | `.dev.vars` `TEXT_PROVIDER=claude` + `ANTHROPIC_API_KEY` | (아래 "실제 호출 확인"에 기록) |

## 실제 호출 확인

`.dev.vars`에 `TEXT_PROVIDER=claude`와 `ANTHROPIC_API_KEY`를 넣고(사용자가 직접 입력, 커밋되지 않음) 개발 서버를 다시 띄워 확인했다. 토큰 수는 2차 반영 뒤 추가한 `console.info('[reading] <model> in=… out=… stop=…')` 로그로 읽었다(사용자 데이터 없음).

| 항목 | 결과 |
| --- | --- |
| `GET /api/config` | `{"provider":"workers-ai","textProvider":"claude","features":{"portrait":true,"reading":true}}` |
| `POST /api/reading` ko (`WFQV`, warmth 0.78 · density 0.86 · pace 0.71 · variation 0.64 · pitch 0.31 · brightness 0.42) | 200, 3.6초. 리딩 3문장 147자, 캡션 16자("듣는 사람을 이야기 한가운데로"). 로그 `claude-haiku-5-5 in=1236 out=199 stop=end_turn` |
| `POST /api/reading` en (`CLME`, warmth 0.22 · density 0.35 · pace 0.28 · variation 0.19 · pitch 0.66 · brightness 0.81) | 200, 2.0초. 리딩 4문장 412자, 캡션 35자("Clear, even, and in no hurry at all"). 로그 `claude-haiku-5-5 in=1197 out=161 stop=end_turn` |
| 출력 규칙 점검 | 두 응답 모두 성별·나이가 실린 단어 없음, 숫자·축 이름·타입 코드 인용 없음, 캡션은 한 줄·따옴표·이모지 없음, 한국어는 해요체에 "당신" 없음 |
| 전체 흐름 (브라우저, 합성 스트림) | 녹음 → 생성(단계 "초상을 그리는 중 (조금 걸려요)" → 초상 503(Workers AI 할당량) 뒤 "목소리를 읽는 중") → 결과. `CFME`에 대한 실제 리딩 4문장과 캡션 "밤 서가에서 가장 믿음직한 목소리"가 초상 카드 아래 표시. 네트워크: `/api/config` 1회, `/api/portrait` 1회(503), `/api/reading` 1회(200) |
| 비용 | 입력 약 1,200토큰 + 출력 약 160~200토큰 → 1회 약 $0.0002 (Haiku 5.5 $0.10/$0.50 per MTok). 설계의 "입력 500~700" 추정보다 입력이 많다(Haiku 5.5 토크나이저·시스템 프롬프트). README 수치를 실측으로 갱신 |

실제 초상 생성은 Workers AI 무료 할당량(4006)이 소진된 상태라 이번에도 자리표시로 진행했다(007·008과 같은 상태).
