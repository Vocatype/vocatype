# 006 feature/ai-adapter — 구현 문서

## 요약

AI 제공자를 `worker/ai/`의 어댑터로 분리했다. 기본은 이미지를 만들지 않는 모의 제공자이고, `AI_PROVIDER=workers-ai`와 `ai` 바인딩이 있으면 Cloudflare Workers AI(Flux 1 schnell)가 실사 초상을 생성한다.
클라이언트는 `/api/config`로 기능 여부를 확인하고, 켜져 있을 때만 `/api/portrait`에 **타입 코드와 씨앗**만 보낸다. 음성은 서버로 가지 않는다.
1차 리뷰 반영까지 포함한 최종 상태를 기록한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `shared/api.ts` | API 계약 타입, 요청 크기·씨앗 상한 |
| `worker/ai/types.ts` | `AiProvider` 인터페이스 |
| `worker/ai/mock.ts` | 모의 제공자 (`image: null`) |
| `worker/ai/workersAi.ts` | Workers AI 제공자 (Flux 1 schnell, 4스텝, base64 → data URL) |
| `worker/ai/select.ts` | 환경 변수·바인딩으로 제공자 선택 |
| `worker/ai/select.test.ts`, `worker/ai/workersAi.test.ts` | 선택 규칙, 모의·Workers AI 제공자 |
| `worker/portrait.ts`, `worker/portrait.test.ts` | 본문을 바이트 기준으로 제한해 읽는 `readBodyLimited`, 요청 검증(타입 코드, 32비트 정수 씨앗) |
| `worker/index.ts` | `GET/HEAD /api/config`, `POST /api/portrait`(교차 사이트 403, 속도 제한 429, 검증 400/413, 제공자 실패 503), 잘못된 메서드 405 + `Allow` |
| `worker/index.test.ts` | 가짜 env로 라우트·상태 코드·헤더·속도 제한·제공자 실패 검사 |
| `wrangler.jsonc` | `vars.AI_PROVIDER = "mock"`, `ai` 바인딩(`remote: true`), `ratelimits` PORTRAIT_LIMITER(IP당 1분 5회) |
| `worker-configuration.d.ts` | `wrangler types` 재생성 (`Env.AI`, `Env.AI_PROVIDER`, `Env.PORTRAIT_LIMITER`) |
| `src/features/ai/client.ts`, `client.test.ts` | 설정 조회(세션 캐시), 초상 요청(타임아웃 60초·외부 취소·실패 시 null, JPEG/PNG/WebP data URL만, 4MB 상한) |
| `src/screens/GeneratingScreen.tsx` | 설정 조회를 분석과 동시에 시작, 분석 뒤 초상 단계(indeterminate, `aria-valuenow` 생략), `onGenerated({ profile, portrait })` |
| `src/App.tsx` | 생성 결과에서 `profile`·`portrait` 설정 |
| `src/i18n/messages/{ko,en}.ts` | 초상 단계 문구 |
| `src/styles/global.css` | 초상 단계 진행 막대 애니메이션 |
| `README.md` | AI 제공자 절(설정 파일로만 전환, 배포 후 씨앗 결정성 확인, `.dev.vars`, 속도 제한 유지), 알려진 한계 |

## 주요 구현

- **어댑터 경계**: `AiProvider { name, supportsPortrait, generatePortrait({ prompt, seed }) }`. 모의 제공자는 `supportsPortrait: false`라 `/api/config`가 `features.portrait: false`를 주고 클라이언트는 초상을 요청하지 않는다. Workers AI 제공자는 `@cf/black-forest-labs/flux-1-schnell`을 4스텝으로 호출하고 base64를 `data:image/jpeg;base64,` URL로 감싼다. 생성 타입에 `seed`가 없어 교차 타입으로 넘긴다. `seed`는 Cloudflare 예제 코드에만 등장하고 파라미터 표에는 없어 지원이 **미확인**이다. 무시되더라도 호출은 실패하지 않으며, README의 배포 후 확인 절차(같은 요청 2회 → 같은 이미지)로 검증한다.
- **제공자 선택**: `AI_PROVIDER === 'workers-ai'`이고 `env.AI` 바인딩이 있을 때만 Workers AI, 그 밖에는 모의. 알 수 없는 값은 모의로 해석한다. 바인딩은 `remote: true`로 선언해 로컬 개발에서도 원격 자원임을 명시한다(모의 상태에서는 호출하지 않는다).
- **요청 검증**: 본문을 스트림으로 읽으며 **바이트** 기준 1KB를 넘으면 중단하고 413(`content-length`가 크면 읽지 않고 413). JSON 파싱 실패·타입 코드 불일치·씨앗이 0 이상 32비트 정수가 아니면 400. 추가 필드는 버린다. 프롬프트는 서버가 `buildPortraitPrompt(typeCode)`로 만들므로 엔드포인트를 임의 이미지 생성기로 쓸 수 없다.
- **남용 방지**: 인증이 없는 POST이므로 Workers Rate Limiting 바인딩(`PORTRAIT_LIMITER`, 접속 IP당 1분 5회)으로 429를 돌려주고, 브라우저가 보내는 `Sec-Fetch-Site`가 `same-origin`/`none`이 아니면 403으로 거절한다. IP는 제한 판단에만 순간적으로 쓰고 저장하지 않는다. 바인딩이 없는 환경에서는 제한 없이 동작한다(테스트).
- **메서드**: `HEAD`는 `GET`으로 취급하고, 허용되지 않은 메서드는 405와 `Allow` 헤더로 답한다.
- **오류 처리**: 제공자 예외는 세부 내용을 숨기고 503 `provider_failed`. 클라이언트는 어떤 실패(HTTP 오류, 타임아웃 60초, 취소, 이상한 응답)도 `null`로 바꾸고 자리표시 초상으로 진행한다. 응답 이미지는 JPEG/PNG/WebP base64 data URL 형식이고 4MB 이하일 때만 받아들인다(SVG 등 제외).
- **클라이언트 흐름**: `/api/config` 조회(세션 캐시, 실패 시 초상 꺼짐으로 간주)를 분석과 동시에 시작 → 분석(0~85%) → 켜져 있으면 초상 단계(indeterminate: 펄스 애니메이션, `aria-valuenow` 생략, `aria-valuetext`는 단계 문구만, "조금 걸려요" 안내) → 결과. `AbortController`가 분석과 초상 요청 모두를 취소한다. 결과로 `{ profile, portrait }`를 넘기고 `App`이 둘 다 상태로 둔다.
- **개인정보**: 서버로 가는 것은 타입 코드(4글자)와 씨앗(정수)뿐이다. 음성·분석 수치·언어는 보내지 않는다. 생성된 이미지는 응답으로만 돌아오고 서버에 남지 않는다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| `ai` 바인딩만 추가 | `remote: true` 명시 | Vite 플러그인이 "AI 바인딩은 항상 원격"이라는 경고를 내므로 설정에 사실을 적는다. |
| `requestPortrait(request)` | `requestPortrait(request, signal)` | 생성 화면의 취소가 초상 요청까지 끊도록. |
| 언급 없음 | 생성 결과 타입 `GenerationResult { profile, portrait }` | 초상이 분석 결과와 함께 한 번에 넘어가야 결과 화면이 중간 상태를 보지 않는다. |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 (`wrangler types` 재생성 후 `Env.AI: Ai`, `Env.AI_PROVIDER: "mock"`) |
| 린트 | `npm run lint` | 경고 0, 오류 0 |
| 단위 테스트 | `npm test` | 21 파일 121 테스트 통과 (제공자 선택 4, 모의 제공자, Workers AI 호출 인자·data URL·빈 응답, 요청 검증 5 + 바이트 제한 2, 라우트 6(상태 코드·헤더·HEAD·405·403·429·503), 클라이언트 캐시·실패·전송 본문·이상 응답(SVG·4MB)·취소·타임아웃) |
| 빌드 | `npm run build` | 통과. 출력 `wrangler.json`에 `vars.AI_PROVIDER`, `ai.binding`, `ratelimits` 포함 |
| API (개발 서버, mock) | `curl` | `GET /api/config` → `{"provider":"mock","features":{"portrait":false}}`; `HEAD /api/config` 200; `POST /api/config` 405; `POST /api/portrait {WFQV, 123}` → `{"image":null,"provider":"mock"}`; 잘못된 코드 400; 2KB 본문 413; `GET /api/portrait` 405; `sec-fetch-site: cross-site` 403; 같은 IP 6번째 요청 429(로컬 바인딩 에뮬레이션); `/api/health` 정상 |
| 전체 흐름 (mock) | 브라우저 | 분석 후 `/api/config` GET 한 번만 발생, 초상 단계 없이 결과 도달, 자리표시 초상과 "준비 중" 안내 |
| 전체 흐름 (제공자 켜짐 모의) | 브라우저, `fetch`를 가로채 `portrait: true`와 1.5초 뒤 64×64 JPEG data URL 응답 | 단계 "타입을 정하는 중" → "초상을 그리는 중 (조금 걸려요)"(펄스 막대), `/api/portrait` 본문은 `{"typeCode":"WFQE","seed":2150221041}`만, 결과에 `<img src="data:image/jpeg…">`, "준비 중" 안내 없음 |
| 초상 실패 | 브라우저, `/api/portrait`가 503 응답 | 결과 화면에 정상 도달, 자리표시 초상과 "AI 초상은 준비 중이에요" 안내. 흐름이 막히지 않음 |
| 초상 포함 저장 이미지 | 브라우저, 모의 초상(64×64, 가운데 흰 원) 응답 뒤 저장 | 1080×1920 PNG의 초상 영역 가운데 픽셀 (255, 255, 255), 모서리 (35, 34, 50) — 초상이 cover 방식으로 그려짐 |
| Workers AI 실제 호출 | — | Cloudflare 계정 로그인이 필요해 이 작업에서는 수행하지 않음. README의 배포 후 확인 절차 참고 |
