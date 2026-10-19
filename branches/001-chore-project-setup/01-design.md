# 001 chore/project-setup — 설계 문서

## 목표

Cloudflare Workers에 배포되는 React 단일 페이지 앱의 기반을 만든다.
이후 작업(메인 화면, 녹음, 분석, 결과, AI 어댑터)이 공통으로 쓰는 다음 요소를 이 작업에서 확정한다.

- 빌드·배포 구성 (Vite + Cloudflare Vite 플러그인 + Wrangler)
- 한국어/영어 i18n (방문 시마다 자동 감지, 화면에서 전환, 저장 안 함)
- 테마 (시스템 자동 + 라이트/다크 선택, 저장 안 함)
- 서비스 이름 상수
- 전역 스타일 토큰과 기본 컴포넌트
- Worker API 뼈대 (`/api/health`)
- 문서 폴더 규칙 (`branches/`)과 README

## 범위

### 포함

- `package.json` 스크립트: `dev`, `build`, `preview`, `deploy`, `lint`, `test`, `typecheck`, `cf-typegen`
- `wrangler.jsonc`: Workers + Static Assets, SPA 폴백, `/api/*`만 Worker 우선 처리
- `vite.config.ts` (앱 + Worker), `vitest.config.ts` (단위 테스트 전용)
- TypeScript 프로젝트 참조 구성 (`tsconfig.app/node/worker`)
- `src/app/config.ts` 서비스 이름 상수
- `src/i18n/` 로케일 감지, 메시지 사전, Provider, `useI18n`
- `src/theme/` 테마 해석, Provider, `useTheme`
- `src/components/` `TopBar`, `Logo`, `Button`
- `src/styles/global.css` 디자인 토큰, 리셋, 레이아웃
- `worker/index.ts` `/api/health` 응답, 나머지 `/api/*` 404
- 단위 테스트: 로케일 감지, 테마 해석
- README: 스택, 명령, Cloudflare Git 연동 배포 방법, 개인정보 원칙, 작업 흐름

### 제외

- 화면 흐름(메인 → 녹음 → 생성 → 결과)은 002 이후
- AI 바인딩과 제공자 구현은 006
- 원격 저장소, CI 구성 (요구사항상 Cloudflare가 직접 빌드·배포)

## 구조

```
.
├── branches/                 작업 단위 문서
├── public/favicon.svg
├── src/
│   ├── main.tsx              진입점. Provider 조립
│   ├── App.tsx               앱 셸 (TopBar + 본문)
│   ├── app/config.ts         SERVICE_NAME 등 상수
│   ├── i18n/
│   │   ├── locales.ts        Locale 타입, detectLocale()
│   │   ├── messages/ko.ts    한국어 사전 (키의 원본)
│   │   ├── messages/en.ts    영어 사전 (ko와 같은 키 집합을 타입으로 강제)
│   │   └── I18nProvider.tsx  Context, useI18n()
│   ├── theme/
│   │   ├── theme.ts          ThemePreference, resolveTheme()
│   │   └── ThemeProvider.tsx Context, useTheme()
│   ├── components/           TopBar, Logo, Button
│   └── styles/global.css     토큰, 리셋
├── worker/index.ts           fetch 핸들러
├── vite.config.ts            react + cloudflare 플러그인
├── vitest.config.ts          테스트 전용 (cloudflare 플러그인 제외)
├── wrangler.jsonc
└── tsconfig*.json
```

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| Cloudflare Pages 대신 Workers + Static Assets | Pages는 유지보수 모드이고 Cloudflare가 Workers로의 이전을 권장한다. Git 연동 빌드(Workers Builds)가 `npm run build` → `npx wrangler deploy`를 그대로 수행한다. |
| `@cloudflare/vite-plugin` 사용 | 개발 서버에서 실제 workerd 런타임으로 Worker를 함께 띄우고, `vite build`가 배포용 `wrangler.json`을 `dist/`에 생성해 `wrangler deploy`가 그대로 읽는다. |
| `run_worker_first: ["/api/*"]` | API만 Worker가 처리하고 나머지는 정적 자산이 먼저 응답한다. 없는 경로는 SPA 폴백으로 `index.html`을 준다. |
| i18n/테마를 저장하지 않음 | 요구사항: 쿠키·로컬스토리지 등 어떤 저장도 하지 않는다. 방문 시마다 `navigator.languages`와 `prefers-color-scheme`로만 결정하고, 전환 값은 메모리에만 둔다. |
| 메시지 키를 `ko.ts`에서 파생 | 영어 사전이 키를 빠뜨리면 컴파일 오류가 나도록 `satisfies Record<MessageKey, string>`로 강제한다. |
| 외부 폰트·분석 스크립트 없음 | 제3자 요청 자체가 개인정보 노출 경로가 된다. 시스템 폰트 스택만 쓴다. |
| 린터는 oxlint | 현재 Vite react-ts 템플릿 기본값이며 설정이 작다. |
| 서비스 이름은 `SERVICE_NAME` 상수 | 아직 확정 전이므로 한 곳에서만 바꾸면 되게 한다. 로고, `<title>`, Worker 응답이 모두 이 상수를 읽는다. |

## 인터페이스

```ts
// src/i18n
type Locale = 'ko' | 'en'
function detectLocale(languages: readonly string[]): Locale   // 'ko*' 가 먼저 나오면 ko, 아니면 en
useI18n(): { locale, setLocale, t(key, params?) }

// src/theme
type ThemePreference = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'
function resolveTheme(pref: ThemePreference, systemDark: boolean): ResolvedTheme
useTheme(): { preference, resolved, setPreference }

// worker
GET /api/health → 200 { ok: true, service: SERVICE_NAME, time: ISO }
*   /api/*      → 404 { error: 'not_found' }
```

## 검증 계획

1. `npm run typecheck` 통과
2. `npm run lint` 경고 0
3. `npm test` 통과 (로케일 감지, 테마 해석)
4. `npm run build` 성공, `dist/client/index.html`과 Worker 번들, 출력 `wrangler.json` 생성 확인
5. `npm run dev`로 브라우저에서 셸 렌더링, 언어·테마 전환, `/api/health` JSON 응답 확인
