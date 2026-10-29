# Vocatype

목소리를 녹음하면 브라우저 안에서 분석해 보이스 타입, 퍼스널 컬러, 시그니처 향, 사운드 시그니처, 궁합 타입을 만들고, 모든 요소를 1080×1920 이미지 한 장으로 저장할 수 있는 웹 서비스.
AI 초상(실사)은 OpenAI GPT 이미지 모델(`gpt-image-2.5-flare`) 어댑터로, 사람마다 다른 "목소리 해설" 문단과 공유용 캡션은 Claude API → 무료 Workers AI 텍스트 모델 순서의 폴백 체인으로 생성하며 각각 설정 하나로 켠다. 로그인, 쿠키, 저장소를 전혀 쓰지 않는다.

서비스 이름은 [`shared/config.ts`](shared/config.ts)의 `SERVICE_NAME` 상수 한 곳에서만 바꾼다.

## 화면 흐름

```
메인(로고 + 시작) → 녹음(스크립트 낭독) → 생성 중 → 결과(카드, 이미지 저장)
```

## 기술 스택

| 영역 | 선택 |
| --- | --- |
| 프론트엔드 | React 19, TypeScript, Vite 8 |
| 서버 | Cloudflare Workers + Static Assets (`worker/index.ts`, `/api/*`) |
| 분석 | 브라우저 Web Audio (YIN 피치, 에너지, 조음 속도, 스펙트럼 기울기) → 4축 16타입 |
| AI | 어댑터(`worker/ai/`). 초상: OpenAI(`gpt-image-2.5-flare`, medium, 키가 있을 때) — mock·Workers AI(Leonardo Lucid Origin)로 바꿀 수 있음. 리딩 텍스트: 폴백 체인 — Claude(`@anthropic-ai/sdk`, 기본 `claude-haiku-5-5`, 키가 있을 때) → Workers AI(Llama 4 Scout, 무료 할당량) → 고정 문구 |
| 빌드/배포 | `@cloudflare/vite-plugin`, Wrangler. Cloudflare Workers Builds가 Git 푸시마다 빌드·배포 (별도 CI 없음) |
| 린트/테스트 | oxlint, Vitest |
| 언어 | 한국어 / 영어 (브라우저 언어 자동 감지, 화면에서 전환) |
| 테마 | 시스템 자동 + 라이트/다크 선택 (저장하지 않음) |

## 개발

요구 환경: Node.js 22 이상, npm 10 이상.
지원 브라우저: CSS `light-dark()`, `color-mix()`, `dvh`를 쓰므로 2024년 이후 버전(Chrome 123+, Safari 17.5+, Firefox 120+)을 기준으로 한다.

```bash
npm install
npm run dev          # http://localhost:5173 (앱 + Worker를 함께 띄움)
npm run typecheck    # tsc -b
npm run lint         # oxlint
npm test             # vitest run
npm run build        # dist/client (정적 자산) + dist/worker (Worker, wrangler.json)
npm run preview      # 빌드 결과를 로컬에서 미리보기
npm run deploy       # 빌드 후 wrangler deploy (로컬에서 수동 배포할 때)
npm run cf-typegen   # wrangler.jsonc를 바꾼 뒤 worker-configuration.d.ts 재생성
```

## 폴더 구조

```
branches/        작업 단위 문서 (설계 → 구현 → 리뷰). 규칙은 branches/README.md
public/          정적 파일
shared/          앱과 Worker가 함께 쓰는 상수·타입
src/             React 앱
  components/    공통 컴포넌트
  features/      analysis(분석), profile(결과 표현), recorder(녹음), scripts(낭독 글), signature(사운드 시그니처), export(이미지 저장), ai(API 클라이언트)
  screens/       메인, 녹음, 생성, 결과 화면
  i18n/          로케일 감지, 메시지 사전, Provider
  theme/         테마 해석, Provider
  styles/        디자인 토큰과 전역 스타일
worker/          Cloudflare Worker (API)
  ai/            AI 제공자 어댑터 (초상: mock, openai, workers-ai · 리딩 체인: claude, workers-ai, mock)
wrangler.jsonc   Workers 설정
```

## Cloudflare 배포 (Git 연동, CI 없음)

1. 이 저장소를 GitHub 또는 GitLab에 올린다.
2. Cloudflare 대시보드 → Workers & Pages → Create → **Import a repository** 에서 저장소를 고른다.
3. 빌드 설정:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy` (기본값)
   - Root directory: `/`
4. 저장 후 main에 푸시할 때마다 Cloudflare가 빌드하고 배포한다.

`vite build`가 `dist/worker/wrangler.json`을 만들고 `wrangler deploy`가 그 파일을 읽으므로 추가 설정은 없다.

## 개인정보 원칙

- 로그인, 회원가입, 쿠키, localStorage, sessionStorage를 쓰지 않는다.
- 언어와 테마는 방문할 때마다 브라우저 설정으로만 정하고, 전환 값은 페이지를 닫으면 사라진다.
- 녹음은 브라우저 안에서 분석한다. AI 초상 생성 요청에는 타입 코드와 씨앗만(OpenAI에는 서버가 타입 코드로 만든 프롬프트만), 목소리 해설 요청에는 타입 코드·여섯 축 수치(0..1, 소수 둘째 자리)·언어만 들어가며 음성은 어떤 경우에도 서버로 가지 않는다.
- 외부 폰트, 분석 스크립트, 광고 등 제3자 요청을 넣지 않는다. 브라우저는 자기 Worker하고만 통신하고, AI 제공자 호출은 Worker가 대신 한다(사용자 IP는 제공자에 가지 않는다).
- Workers 요청 로그(`observability`)는 기본 비활성화한다.
- 초상·해설 생성 속도 제한에 접속 IP를 쓰지만 Workers Rate Limiting 바인딩 안에서 최대 60초 동안 카운터 키로만 유지되고 영구 저장·로그는 없다.

## AI 제공자

AI는 어댑터(`worker/ai/`) 뒤에 있다. 설정이 없거나 키·바인딩이 없으면 이미지를 만들지 않는 모의 제공자가 된다. 모의 상태에서도 분석·결과·이미지 저장은 전부 동작하며, 초상 자리에는 퍼스널 컬러와 사운드 시그니처로 그린 자리표시 초상이 들어간다. 초상 제공자는 `AI_PROVIDER` 로 하나만 고르고, 실패하면 다른 제공자로 넘어가지 않고 자리표시 초상으로 간다(두 모델의 화풍을 섞지 않는다, 031).

| 제공자 | 설정 | 하는 일 |
| --- | --- | --- |
| `openai` (현재) | `AI_PROVIDER = "openai"` + 비밀 `OPENAI_API_KEY` | `gpt-image-2.5-flare`(`IMAGE_MODEL`로 변경)로 1024×1024 실사 초상 생성, 품질 medium, jpeg. `seed` 미지원 |
| `workers-ai` | `AI_PROVIDER = "workers-ai"` + `ai` 바인딩 | `@cf/leonardo/lucid-origin`으로 768×768 실사 초상 생성 (`seed` 지원, 무료 할당량) |
| `mock` | `AI_PROVIDER` 없음 또는 `mock`, 또는 위의 키·바인딩이 없을 때 | 초상 생성 안 함 (`/api/config` → `features.portrait: false`) |

### OpenAI 켜기 (현재 운영)

1. OpenAI 플랫폼(<https://platform.openai.com>)에서 준비한다.
   - GPT 이미지 모델은 **조직 인증(Organization Verification)** 이 필요할 수 있다. 플랫폼 설정의 Organization 화면에서 인증한다(신분증 확인, 반영까지 시간이 걸릴 수 있다. 메뉴 이름은 바뀔 수 있다).
   - Billing에서 **선불 크레딧**을 넣고 자동 충전(auto recharge)은 꺼 둔다. 잔액이 실제 비용 상한이 된다. 잔액은 조직 전체가 함께 쓰므로, 다른 프로젝트가 있는 조직이면 바닥났을 때 그 프로젝트들도 함께 멈춘다(가능하면 이 서비스 전용 조직). 예산 알림(Limits)도 걸어 둔다.
   - 이 서비스 전용 프로젝트를 만들고 그 안에서 API 키를 발급한다. 가능하면 권한을 Restricted로 두고 이미지 생성만 허용한다(좁힌 권한으로 `403`이 나면 4단계 로그로 확인하고 권한을 넓힌다).
2. 키를 Worker의 **비밀**로 넣는다. 저장소, `wrangler.jsonc`, 대시보드 변수(Plaintext) 화면에는 넣지 않는다. 둘 중 하나:
   ```bash
   npx wrangler secret put OPENAI_API_KEY
   ```
   또는 Cloudflare 대시보드 → Workers & Pages → `vocatype` → Settings → Variables and Secrets → Add → Type **Secret**, 이름 `OPENAI_API_KEY`. 비밀은 `wrangler deploy`가 덮어쓰지 않으므로 Git 푸시 배포 뒤에도 남는다.
3. `wrangler.jsonc`의 `vars.AI_PROVIDER`가 `"openai"`인 상태로 커밋·푸시한다(031에서 이미 바꿨다). 키보다 배포가 먼저 되면 키가 없어 mock(자리표시 초상)으로 동작할 뿐 깨지지 않는다.
4. 배포 후 `https://<worker>/api/config`가 `{"provider":"openai","features":{"portrait":true}}`를 돌려주면 켜진 것이다. 실제 한 장은 아래 명령으로 확인한다(1장이 청구된다. 장당 가격은 아래 "보내는 데이터와 비용"). 503이면 Worker 로그(`npx wrangler tail --name <worker>`)의 `[portrait] provider failed: OpenAiError: HTTP <상태> <코드>` 줄을 본다(`401` 키 오류, `403` 보통 조직 인증 미완료·키 권한 부족이거나 OpenAI가 지원하지 않는 지역에서 실행된 경우(`unsupported_country_region_territory`), `429` 한도·잔액 부족, `400 moderation_blocked` 검열, `200 invalid_body` 응답 본문 이상). 성공하면 `[portrait] openai <모델> in=… out=…` 토큰 수 줄이 남는다. **첫 몇 장에서 함께 확인한다**: `out=` 토큰 수(장당 가격 확정), `wrangler tail`의 요청 결과(`ok`인지, CPU 한도 초과 `exceededCpu`인지)와 걸린 시간, OpenAI 사용량 화면의 장수가 성공 응답 수와 맞는지(45초에서 끊긴 생성도 과금될 수 있다).
   ```bash
   curl -s -X POST https://<worker>/api/portrait -H 'content-type: application/json' -d '{"typeCode":"WFQV","seed":123}' -o portrait-1.json
   node -e "const r=require('./portrait-1.json');require('fs').writeFileSync('portrait-1.jpg',Buffer.from(r.image.split(',')[1],'base64'))"
   ```
5. 로컬에서 실제 모델을 호출해 보려면 프로젝트 루트의 `.dev.vars`(커밋되지 않음)에 `AI_PROVIDER=openai`와 `OPENAI_API_KEY=sk-…` 두 줄을 넣고 `npm run dev`를 실행한다. 로컬 호출도 장마다 과금된다.
6. Worker는 OpenAI 호출을 최대 45초(`PORTRAIT_SERVER_TIMEOUT_MS`) 기다리고 넘으면 끊어 503으로 답한다. 클라이언트는 60초(`PORTRAIT_CLIENT_TIMEOUT_MS`)까지 기다린다(`shared/api.ts`의 초상 시간 규칙).

### Workers AI로 되돌리기

1. `wrangler.jsonc`의 `vars.AI_PROVIDER`를 `"workers-ai"`로 바꿔 커밋·푸시한다. (`ai` 바인딩과 속도 제한은 이미 들어 있다.)
   대시보드의 변수 화면에서 바꾸면 안 된다. `wrangler deploy`가 다음 푸시 때 설정 파일 값으로 덮어써 조용히 `mock`으로 돌아간다.
2. 푸시하면 Cloudflare가 빌드·배포한다. 배포 후 `https://<worker>/api/config`가 `{"provider":"workers-ai","features":{"portrait":true}}`를 돌려주면 켜진 것이다. 초상이 다시 무료 할당량을 쓰므로 속도 제한(분당 2회)은 그대로 둬도 된다.
3. 같은 요청을 두 번 보내 같은 얼굴이 나오는지 확인한다(`seed` 결정성). Flux 1 schnell은 `seed` 입력을 거부해 Leonardo Lucid Origin으로 바꿨다. **해시·바이트 비교로는 판정할 수 없다.** 같은 씨앗이라도 응답 바이트는 매번 조금 다르므로(GPU 비결정성), 두 응답의 `image`를 파일로 풀어 눈으로 보거나 픽셀 차이를 잰다. 2026-10-20 실측에서 같은 씨앗 2회는 같은 얼굴·구도에 채널 평균 차이 3/255, 다른 씨앗은 다른 얼굴에 33/255였다(`branches/015-docs-portrait-seed-check/02-implementation.md`). 503이 계속 나오면 Worker 로그(`npx wrangler tail --name <worker>`)에서 `[portrait] provider failed:` 줄을 확인한다. 무료 플랜은 Workers AI 일일 할당량(10,000 neurons)이 있어 소진되면 `4006` 오류로 503이 나며, 이때 결과 화면은 자리표시 초상으로 진행한다. Worker는 초상 호출을 최대 45초(`PORTRAIT_SERVER_TIMEOUT_MS`) 기다리고 넘으면 끊어 503으로 답한다. 클라이언트는 60초(`PORTRAIT_CLIENT_TIMEOUT_MS`)까지 기다린다(`shared/api.ts`의 초상 시간 규칙). 초상 1장이 약 1,400~1,500뉴런이라 확인 호출도 할당량을 쓴다.
   ```bash
   curl -s -X POST https://<worker>/api/portrait -H 'content-type: application/json' -d '{"typeCode":"WFQV","seed":123}' -o portrait-1.json
   node -e "const r=require('./portrait-1.json');require('fs').writeFileSync('portrait-1.jpg',Buffer.from(r.image.split(',')[1],'base64'))"
   ```
4. 로컬에서 실제 모델을 호출해 보려면 `npx wrangler login` 뒤 프로젝트 루트에 `.dev.vars` 파일을 만들어 `AI_PROVIDER=workers-ai` 한 줄을 넣고 `npm run dev`를 실행한다(`.dev.vars`는 커밋되지 않는다). Workers AI 바인딩은 로컬에서도 Cloudflare 계정을 통해 원격으로 호출되며 과금될 수 있다.

### 보내는 데이터와 비용

- 초상 생성 요청에는 **타입 코드(4글자)와 씨앗(정수)** 만 들어간다. 음성, 녹음 파일, 분석 수치는 서버로 가지 않는다.
- 프롬프트는 서버가 타입 코드로만 만든다. 성별·나이·인종은 지정하지 않으며, 생성된 이미지는 응답으로만 돌아가고 서버에 저장되지 않는다.
- OpenAI에는 이 영어 프롬프트와 모델·크기·품질 설정만 간다. 씨앗·IP·브라우저 정보는 보내지 않고(`user`·`safety_identifier` 없음), 요청은 Worker가 보내므로 사용자 IP는 OpenAI에 가지 않는다. OpenAI 문서([Your data](https://developers.openai.com/api/docs/guides/your-data))상 `/v1/images/generations` 데이터는 학습에 쓰이지 않고 남용 감시를 위해 30일 보존된다.
- OpenAI 비용(`gpt-image-2.5-flare`, 1024×1024, medium): 토큰 단가는 이미지 출력 100만 토큰당 $30, 텍스트 입력 $5로 공개돼 있지만 **2.5의 장당 가격은 공개되지 않았다**(공식 계산기도 2.5의 토큰 소비는 추정하지 않는다). 제3자 자료는 장당 약 $0.013, 같은 토큰 단가인 GPT Image 2의 공식 표는 1024×1024 medium $0.053(low $0.006, high $0.211)이다. 실측 전에는 **장당 $0.013~0.053**(프롬프트 입력 약 $0.0004 별도), 1만 장에 약 $135~535로 본다. 첫 호출의 `[portrait] openai … out=…` 출력 토큰 × $30/100만으로 확정하고, 그 값으로 품질·속도 제한을 다시 본다. 단가는 [OpenAI 가격표](https://developers.openai.com/api/docs/pricing)를 확인한다.
- 초상 엔드포인트는 인증이 없으므로 **속도 제한을 반드시 유지한다**: `wrangler.jsonc`의 `ratelimits`가 접속 IP당 1분에 2회로 막고(초과 시 429, 031에서 5회 → 2회), 다른 사이트에서 온 요청(`Sec-Fetch-Site`)은 403으로 거절한다. 한 번의 생성에 초상은 1장이라 혼자 쓰는 사용자에게는 충분하다. 다만 회사·학교·통신사 공유 IP(CGNAT)처럼 여러 사람이 같은 IP를 쓰면 같은 콜로에서 1분 안 세 번째 생성부터 429로 자리표시 초상이 조용히 나온다. IP는 Rate Limiting 바인딩 안에서 최대 60초 동안 카운터 키로만 유지되고 영구 저장·로그는 없다. 제한은 Cloudflare 콜로(지역 데이터센터)별로 적용되므로 전 세계 합산 한도는 2회보다 클 수 있다.
- IP 하나가 제한을 쉬지 않고 채우면 하루 2,880장 ≈ **$39~154**다(5회였다면 7,200장 ≈ $97~385). IP가 여럿이면(IPv6 주소를 바꿔 가며 보내는 경우 포함) 코드상 전체 상한은 없고, **전체 상한은 OpenAI 선불 크레딧 잔액(자동 충전 끔)뿐**이다. 잔액은 조직 전체가 함께 쓴다. 크레딧이 바닥나면 OpenAI가 `429`로 거절하고 결과 화면은 자리표시 초상으로 진행한다.
- OpenAI 조직 한도는 사용 등급(usage tier)을 따른다. 누적 크레딧 구매 $5부터 Build(이 모델 분당 20장), $100에 Launch(150장), $500에 Grow(250장)로 자동으로 오른다. 기준은 사용량이 아니라 **누적 구매액**이라, 자동 충전을 끈 채로는 크레딧을 더 사야 오른다. 동시에 많이 몰려 한도를 넘으면 `429`로 자리표시 초상이 나온다.

### 텍스트 제공자 (목소리 해설)

결과 화면의 "목소리 해설"(3~4문장)과 공유용 캡션 한 줄은 초상과 별도의 **텍스트 제공자 폴백 체인**이 만든다. 화면에서는 "목소리 해설"이라 부르고(026), 코드·API에서는 `reading`(리딩)이라는 이름을 그대로 쓴다(`/api/reading`, `ReadingResponse` 등). README에서 "리딩"은 이 기능을 가리킨다. 지금 운영 순서는 `claude,workers-ai`다. 모든 사용자가 같은 모델(Claude)의 문장을 받게 하고, Claude가 실패하면 무료 Workers AI 모델이 받친다(022에서 010의 "무료 우선" 순서를 바꿨다. 근거는 `branches/022-chore-claude-first-reading/01-design.md`).

```
claude (키가 있을 때만) ──실패──▶ workers-ai (무료 Workers AI 텍스트 모델) ──실패──▶ mock 고정 문구 (화면에는 안 보임)
```

- 체인은 `TEXT_PROVIDER` 콤마 목록을 **순서대로** 시도한다. 실패로 보는 것: Workers AI 무료 할당량 소진(`4006`), 429, 타임아웃, 모델의 생성 거부, 출력이 JSON 계약(리딩 20~600자·캡션 2~100자)에 맞지 않는 경우 전부.
- **Claude가 최대한 답하게 한다(031).** SDK가 일시 오류(529 과부하·429·5xx·요청 12초 타임아웃)에서 최대 2번 더 시도하고(`MAX_RETRIES`), 출력이 계약에 맞지 않거나 `max_tokens`로 잘리면 Workers AI로 넘기기 전에 Claude를 한 번 더 부른다(`CONTRACT_RETRIES`). 생성 거부(`refusal`)는 다시 불러도 거부되므로 바로 넘긴다. 추가 호출은 실패했을 때만 생긴다.
- 체인 전체에 40초 시간 예산이 있고(`shared/api.ts`의 `READING_CHAIN_BUDGET_MS`, 031에서 25초 → 40초), 시도하는 제공자(Workers AI·Claude 모두)에는 남은 예산이 중단 신호로 간다. 뒤에 제공자가 남아 있으면 그 몫 12초(`FALLBACK_RESERVE_MS`)를 빼고 주므로, 운영 순서에서 Claude는 **28초**를 받고(요청 12초 두 번이 다 들어간다) 그래도 실패하면 뒤 제공자가 남은 12초 이상으로 시도된다. 3초 미만이 남으면 다음 제공자는 건너뛴다. 클라이언트는 그보다 긴 45초(`READING_CLIENT_TIMEOUT_MS`)를 기다려, 클라이언트가 포기한 뒤 Worker가 제공자를 새로 부르지 않는다(체인 순서와 상관없이). Claude가 정상일 때(2~4초)는 리딩이 초상과 병렬이라 대기가 늘지 않고, Claude가 느리게 실패할 때만 대기가 최대 40초까지 는다.
- 모두 실패하면 응답은 200이지만 `provider: "mock"`이고, 클라이언트는 이를 "리딩 없음"으로 보고 카탈로그의 타입 설명을 보여 준다. 사용자에게 모의 문구는 보이지 않는다.
- `/api/reading` 응답의 `provider`에 실제로 답한 제공자가 들어가고, Worker 로그에 폴백 이유가 `[reading] claude failed, falling back: …`처럼 오류 이름·메시지만 남는다.
- 두 모델 모두 같은 프롬프트(`worker/ai/readingPrompt.ts`)와 같은 출력 스키마를 쓴다.

| `TEXT_PROVIDER` | 필요한 것 | 체인 | `/api/config` |
| --- | --- | --- | --- |
| `claude,workers-ai` (현재) | 비밀 `ANTHROPIC_API_KEY` + `ai` 바인딩(이미 있음) | claude → workers-ai → mock | `["claude","workers-ai"]` |
| `workers-ai,claude` | 비밀 `ANTHROPIC_API_KEY` + `ai` 바인딩 | workers-ai → claude → mock (무료 우선, 011부터 022 전까지) | `["workers-ai","claude"]` |
| `workers-ai` | `ai` 바인딩 | workers-ai → mock | `textProviders: ["workers-ai"]`, `reading: true` |
| `claude` | 비밀 `ANTHROPIC_API_KEY` | claude → mock | `["claude"]` |
| 없음 / `mock` / 모르는 값 | — | mock만 | `[]`, `reading: false` (클라이언트가 호출하지 않음) |

키가 없으면 `claude`는 체인에서 조용히 빠진다(오류 없이 `workers-ai`만 남는다). 모델: Workers AI는 `@cf/meta/llama-4-scout-17b-16e-instruct`(`worker/ai/workersAiText.ts`의 상수로 교체. 011에서 Llama 3.3 70B가 영어 출력을 끝내지 못해 바꿨다), Claude는 `claude-haiku-5-5`(`vars.TEXT_MODEL`로 변경, effort를 지원하는 Claude 4.6 이상·5.x만).

#### 체인에 Claude 추가하기

1. API 키를 **비밀**로 넣는다. 저장소, `wrangler.jsonc`, 대시보드 변수 화면에는 넣지 않는다.
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   ```
2. `wrangler.jsonc`의 `vars.TEXT_PROVIDER`를 `"claude,workers-ai"`(Claude 우선, 현재 값) 또는 `"workers-ai,claude"`(무료 우선)로 바꿔 커밋·푸시한다.
3. 배포 후 `https://<worker>/api/config`가 고른 순서대로 `"textProviders":["claude","workers-ai"]`(Claude 우선) 또는 `["workers-ai","claude"]`(무료 우선)를 돌려주면 체인에 들어간 것이다. 어느 제공자가 답하는지는 `/api/reading` 응답의 `provider`로 본다. 503은 체인 밖의 예외일 때만 나오며, 그때는 Worker 로그(`npx wrangler tail --name <worker>`)의 `[reading]` 줄을 본다.
4. 로컬에서 체인을 돌려 보려면 프로젝트 루트의 `.dev.vars`(커밋되지 않음)에 두 줄을 넣고 `npm run dev`를 실행한다. Workers AI 바인딩은 로컬에서도 Cloudflare 계정(`npx wrangler login`)을 통해 원격 호출되며 무료 할당량을 쓴다. 아래처럼 `claude,workers-ai`로 두면 로컬 호출도 리딩마다 Anthropic 과금(1회 약 $0.0002)이 생긴다. Anthropic 과금 없이 보려면 `TEXT_PROVIDER=workers-ai`로 둔다.
   ```
   TEXT_PROVIDER=claude,workers-ai
   ANTHROPIC_API_KEY=sk-ant-…
   ```
   ```bash
   curl -s -X POST http://localhost:5173/api/reading -H 'content-type: application/json' -d '{"typeCode":"WFQV","axes":{"warmth":0.8,"density":0.3,"pace":0.7,"variation":0.6,"pitch":0.4,"brightness":0.5},"locale":"ko"}'
   ```

#### 보내는 데이터와 비용

- 리딩 요청에는 **타입 코드(4글자), 여섯 축 수치(0..1, 소수 둘째 자리), 언어(ko/en)** 만 들어간다. 음성, 녹음 길이, 씨앗, IP, 브라우저 정보는 보내지 않는다. 제공자(Workers AI 또는 Anthropic)에 가는 것도 이 값들을 서버가 프롬프트(영어 지시문 + 요청 언어의 타입 이름·설명)에 적은 것뿐이며, 요청은 Worker가 보내므로 사용자 IP는 제공자에 가지 않는다. 지금 순서(`claude,workers-ai`)에서는 리딩 요청마다 Anthropic으로 간다. Anthropic에 간 프롬프트와 응답은 [Anthropic API 약관과 데이터 보존 정책](https://www.anthropic.com/legal/commercial-terms)에 따라 처리된다(음성·IP·개인 식별 정보는 포함되지 않는다).
- 프롬프트는 서버가 만든다(`worker/ai/readingPrompt.ts`). 성별·나이·인종·국적·억양·외모·신체·건강·감정 상태를 추정하거나 언급하지 말라는 지침, 성별·나이가 실린 단어 금지, 진단·조언 금지, 수치·축 이름·타입 코드 인용 금지가 들어 있다. 클라이언트는 임의 문장을 생성시킬 수 없다.
- 응답은 JSON 스키마(구조화 출력 / JSON 모드)로 받고 길이(리딩 20~600자, 캡션 2~100자)를 벗어나면 그 제공자의 실패로 보고 다음으로 넘어간다. 생성된 글은 응답으로만 돌아가고 서버에 저장되지 않는다.
- **Workers AI 무료 할당량(하루 10,000뉴런)은 지금은 리딩 예비만 쓴다**(031에서 초상이 OpenAI로 옮겼다). 리딩 1회(Llama 4 Scout, 입력 약 650 + 출력 약 100토큰)는 약 25뉴런이라(011 실측) Claude가 하루 수백 번 실패해도 예비가 바닥나지 않는다. 초상을 `workers-ai`로 되돌리면 초상 1장(Lucid Origin 768×768)이 약 1,400~1,500뉴런(512×512 타일당 636뉴런 + 스텝당 12뉴런)이라 **하루 6~7장이면 소진**되고, 그때는 할당량을 사실상 초상이 쓴다. 순서를 `workers-ai,claude`로 두면 할당량이 소진된 뒤 리딩이 `4006`으로 Claude로 넘어간다. 이미지와 텍스트 모두 자리표시·카탈로그 설명으로 폴백하므로 할당량이 바닥나도 흐름은 끊기지 않는다. 가격은 [Workers AI 가격표](https://developers.cloudflare.com/workers-ai/platform/pricing/)를 확인한다.
- Claude(Haiku 5.5) 비용: 입력 $0.10 / 출력 $0.50 (100만 토큰당). 실제 호출에서 리딩 한 번은 입력 약 1,200토큰, 출력(내부 사고 포함) 약 160~264토큰이었다(009·010 실측, `[reading] claude … in=… out=…` 로그로 확인). **1회 $0.0002 안팎**, 1만 회에 $2 정도다(출력이 계약에 맞지 않아 다시 부른 회차만 최대 2배). 지금 순서에서는 모든 리딩이 Claude로 나가므로, IP 하나가 속도 제한(1분 5회, 콜로별)을 쉬지 않고 채우면 하루 7,200회 ≈ $1.44~1.8이다. 제한 키가 접속 IP라 IP가 여럿이면(IPv6 주소를 바꿔 가며 보내는 경우 포함) 전체 비용에는 코드상 상한이 없고, **전체 상한은 Anthropic 콘솔의 지출 한도뿐**이다. 이 키에 지출 한도를 두는 것을 권한다. 정확한 값은 [Anthropic 가격표](https://www.anthropic.com/pricing)를 확인한다.
- 엔드포인트는 인증이 없으므로 속도 제한(`READING_LIMITER`, 접속 IP당 1분 5회, 초상 제한과 별개)과 교차 사이트 403을 반드시 유지한다.
- 리딩은 생성 시점의 화면 언어로 한 번만 만든다. 결과 화면에서 언어를 바꾸면 다른 언어의 리딩을 섞어 보이지 않고 카탈로그 설명으로 돌아간다(다시 생성하지 않는다).

### 다른 제공자 붙이기

초상은 `worker/ai/types.ts`의 `AiProvider`를 구현하고 `worker/ai/select.ts`에서 고르게 하면 된다. 리딩은 `TextProvider`를 구현하고 `worker/ai/textChain.ts`의 `buildTextChain`에 이름과 조건을 추가하면 체인에 들어간다. 클라이언트는 `/api/config`, `/api/portrait`, `/api/reading` 계약(`shared/api.ts`)만 안다.

## 알려진 한계

- 분석 축의 범위(`src/features/analysis/axes.ts`의 `AXIS_RANGES`)는 합성 신호로만 검증한 초기값이다. 실제 화자 10명 이상의 녹음으로 축 분포를 보고 범위를 보정해야 16개 타입이 고르게 나온다. 자세한 내용은 `branches/004-feature-analysis/02-implementation.md`의 "알려진 한계와 보정".
- 온도 축의 밝기 지표(스펙트럼 기울기)는 음높이와 함께 커지는 경향이 남아 있다. 보정 때 음높이 정규화 지표로 바꾸는 방안을 검토한다.
- OpenAI 초상은 `seed`를 받지 않아 같은 녹음으로 다시 요청해도 다른 얼굴이 나온다. 흐름상 한 녹음에 초상을 한 번만 만들므로 사용자에게 보이는 차이는 없다. Workers AI로 되돌리면 같은 씨앗은 "같은 얼굴·구도"까지 재현되지만 응답 바이트는 매번 조금 달라(GPU 비결정성) 해시로 같은지 판정할 수 없다(015 실측).
- OpenAI 초상의 실제 지연·장당 가격은 아직 재지 않았다(키 등록 전). medium 1024×1024는 Worker 상한 45초 안에 들 것으로 보지만(공식 문서는 "복잡한 프롬프트는 최대 2분"), 배포 후 생성 화면 대기와 로그로 확인한다.
- **과금됐는데 사용자는 자리표시 초상을 받을 수 있는 경로**: Worker가 45초에서 OpenAI 호출을 끊은 경우(끊긴 생성의 과금 여부는 문서에 없다), 사용자가 생성 화면을 떠난 경우(클라이언트는 요청을 끊지만 Worker의 OpenAI 호출이 함께 끊기는지는 확인하지 않았다), Workers CPU 한도에 걸린 경우(1024×1024 jpeg 응답의 JSON 파싱·직렬화는 로컬 측정 수백 KB에 1~4ms. 무료 플랜 10ms 안이지만 엣지에서는 더 느릴 수 있다). 첫 호출들에서 README "OpenAI 켜기" 4단계로 확인한다.
- iOS Safari는 `download` 속성을 새 탭으로 열 수 있다. 공유 시트("공유" 버튼)를 쓰면 사진 앱에 바로 저장할 수 있다.
- 목소리 해설은 생성 시점 언어로 한 번만 만들어진다. 결과 화면에서 언어를 바꾸면 해설 카드가 사라지고 카탈로그 설명만 보인다. 다시 녹음·생성하면 바뀐 언어로 만들어진다.
- 결과는 재미로 보는 해석이며 성격·건강 등 어떤 진단도 아니다.

## 작업 흐름

브랜치 하나 = 작업 하나. 설계 문서 → 구현 → 구현 문서 → 리뷰(차수별) → 리뷰 문서 → `--no-ff` 병합 → 브랜치 삭제.
자세한 규칙은 [branches/README.md](branches/README.md).
