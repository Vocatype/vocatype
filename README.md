# VoicePortrait (ai-voice-image-generator)

목소리를 녹음하면 브라우저 안에서 분석해 보이스 타입, 퍼스널 컬러, 시그니처 향, 사운드 시그니처, 궁합 타입을 만들고, 모든 요소를 1080×1920 이미지 한 장으로 저장할 수 있는 웹 서비스.
AI 초상(실사)은 Cloudflare Workers AI 어댑터로 생성하며 설정 하나로 켠다. 로그인, 쿠키, 저장소를 전혀 쓰지 않는다.

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
| AI | 어댑터(`worker/ai/`). 기본 mock, Workers AI(Flux 1 schnell)로 전환 가능 |
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
  ai/            AI 제공자 어댑터 (mock, workers-ai)
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
- 녹음은 브라우저 안에서 분석한다. AI 초상 생성 요청에는 타입 코드와 씨앗만 들어가며 음성은 어떤 경우에도 서버로 가지 않는다.
- 외부 폰트, 분석 스크립트, 광고 등 제3자 요청을 넣지 않는다.
- Workers 요청 로그(`observability`)는 기본 비활성화한다.
- 초상 생성 속도 제한에 접속 IP를 쓰지만 Workers Rate Limiting 바인딩 안에서 최대 60초 동안 카운터 키로만 유지되고 영구 저장·로그는 없다.

## AI 제공자

AI는 어댑터(`worker/ai/`) 뒤에 있고, 기본값은 이미지를 만들지 않는 모의 제공자다. 모의 상태에서도 분석·결과·이미지 저장은 전부 동작하며, 초상 자리에는 퍼스널 컬러와 사운드 시그니처로 그린 자리표시 초상이 들어간다.

| 제공자 | 설정 | 하는 일 |
| --- | --- | --- |
| `mock` (기본) | `AI_PROVIDER` 없음 또는 `mock` | 초상 생성 안 함 (`/api/config` → `features.portrait: false`) |
| `workers-ai` | `AI_PROVIDER = "workers-ai"` + `ai` 바인딩 | `@cf/black-forest-labs/flux-1-schnell`로 실사 초상 생성 |

### Workers AI 켜기

1. `wrangler.jsonc`의 `vars.AI_PROVIDER`를 `"workers-ai"`로 바꿔 커밋·푸시한다. (`ai` 바인딩과 속도 제한은 이미 들어 있다.)
   대시보드의 변수 화면에서 바꾸면 안 된다. `wrangler deploy`가 다음 푸시 때 설정 파일 값으로 덮어써 조용히 `mock`으로 돌아간다.
2. 푸시하면 Cloudflare가 빌드·배포한다. 배포 후 `https://<worker>/api/config`가 `{"provider":"workers-ai","features":{"portrait":true}}`를 돌려주면 켜진 것이다.
3. 같은 요청을 두 번 보내 같은 이미지가 나오는지 확인한다. Flux 1 schnell의 `seed` 파라미터는 Cloudflare 예제 코드에만 나오고 파라미터 표에는 없어 지원이 확실하지 않다. 다르게 나오면 "같은 녹음 = 같은 얼굴"이 성립하지 않으므로 `seed`를 지원하는 모델로 바꾸는 것을 검토한다.
   ```bash
   curl -s -X POST https://<worker>/api/portrait -H 'content-type: application/json' -d '{"typeCode":"WFQV","seed":123}' | shasum
   ```
4. 로컬에서 실제 모델을 호출해 보려면 `npx wrangler login` 뒤 프로젝트 루트에 `.dev.vars` 파일을 만들어 `AI_PROVIDER=workers-ai` 한 줄을 넣고 `npm run dev`를 실행한다(`.dev.vars`는 커밋되지 않는다). Workers AI 바인딩은 로컬에서도 Cloudflare 계정을 통해 원격으로 호출되며 과금될 수 있다.

### 보내는 데이터와 비용

- 초상 생성 요청에는 **타입 코드(4글자)와 씨앗(정수)** 만 들어간다. 음성, 녹음 파일, 분석 수치는 서버로 가지 않는다.
- 프롬프트는 서버가 타입 코드로만 만든다. 성별·나이·인종은 지정하지 않으며, 생성된 이미지는 응답으로만 돌아가고 서버에 저장되지 않는다.
- 비용은 Cloudflare Workers AI 가격표를 확인한다. 초상 엔드포인트는 인증이 없으므로 **속도 제한을 반드시 유지한다**: `wrangler.jsonc`의 `ratelimits`가 접속 IP당 1분에 5회로 막고(초과 시 429), 다른 사이트에서 온 요청(`Sec-Fetch-Site`)은 403으로 거절한다. IP는 Rate Limiting 바인딩 안에서 최대 60초 동안 카운터 키로만 유지되고 영구 저장·로그는 없다. 제한은 Cloudflare 콜로(지역 데이터센터)별로 적용되므로 전 세계 합산 한도는 5회보다 클 수 있다.

### 다른 제공자 붙이기

`worker/ai/types.ts`의 `AiProvider`를 구현하고 `worker/ai/select.ts`에서 고르게 하면 된다. 클라이언트는 `/api/config`와 `/api/portrait` 계약(`shared/api.ts`)만 안다.

## 알려진 한계

- 분석 축의 범위(`src/features/analysis/axes.ts`의 `AXIS_RANGES`)는 합성 신호로만 검증한 초기값이다. 실제 화자 10명 이상의 녹음으로 축 분포를 보고 범위를 보정해야 16개 타입이 고르게 나온다. 자세한 내용은 `branches/004-feature-analysis/02-implementation.md`의 "알려진 한계와 보정".
- 온도 축의 밝기 지표(스펙트럼 기울기)는 음높이와 함께 커지는 경향이 남아 있다. 보정 때 음높이 정규화 지표로 바꾸는 방안을 검토한다.
- iOS Safari는 `download` 속성을 새 탭으로 열 수 있다. 공유 시트("공유" 버튼)를 쓰면 사진 앱에 바로 저장할 수 있다.
- 결과는 재미로 보는 해석이며 성격·건강 등 어떤 진단도 아니다.

## 작업 흐름

브랜치 하나 = 작업 하나. 설계 문서 → 구현 → 구현 문서 → 리뷰(차수별) → 리뷰 문서 → `--no-ff` 병합 → 브랜치 삭제.
자세한 규칙은 [branches/README.md](branches/README.md).
