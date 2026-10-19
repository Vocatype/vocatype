# VoicePortrait (ai-voice-image-generator)

목소리를 녹음하면 분석 결과로 얼굴 초상, 퍼스널 컬러, 시그니처 향, 사운드 시그니처, 궁합 타입을 만들어 주는 웹 서비스.
로그인, 쿠키, 저장소를 전혀 쓰지 않는다.

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
  i18n/          로케일 감지, 메시지 사전, Provider
  theme/         테마 해석, Provider
  styles/        디자인 토큰과 전역 스타일
worker/          Cloudflare Worker (API)
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
- 녹음은 브라우저 안에서 분석한다. AI 제공자를 연결하더라도 음성은 저장하지 않고 요청 처리에만 쓴다.
- 외부 폰트, 분석 스크립트, 광고 등 제3자 요청을 넣지 않는다.
- Workers 요청 로그(`observability`)는 기본 비활성화한다.

## 작업 흐름

브랜치 하나 = 작업 하나. 설계 문서 → 구현 → 구현 문서 → 리뷰(차수별) → 리뷰 문서 → `--no-ff` 병합 → 브랜치 삭제.
자세한 규칙은 [branches/README.md](branches/README.md).
