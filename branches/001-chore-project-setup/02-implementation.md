# 001 chore/project-setup — 구현 문서

## 요약

Vite 8 + React 19 + TypeScript 7 앱과 Cloudflare Worker를 `@cloudflare/vite-plugin`으로 묶어 한 번의 `npm run build`로 배포 산출물이 나오게 했다.
i18n(ko/en)과 테마(system/light/dark)는 저장 없이 메모리 상태로만 동작한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `package.json`, `package-lock.json` | 의존성과 스크립트 |
| `wrangler.jsonc` | Workers + Static Assets, SPA 폴백, `/api/*` Worker 우선, observability 끔 |
| `vite.config.ts` | react + cloudflare 플러그인, `%SERVICE_NAME%` 치환 플러그인 |
| `vitest.config.ts` | 단위 테스트 설정 (cloudflare 플러그인 제외) |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.worker.json` | 프로젝트 참조 구성. `strict`, `noUncheckedIndexedAccess` |
| `.oxlintrc.json` | 린트 설정, 생성 파일 제외 |
| `index.html`, `public/favicon.svg` | 진입 HTML (`%SERVICE_NAME%`), 파비콘 |
| `shared/config.ts` | `SERVICE_NAME` 상수 |
| `src/main.tsx`, `src/App.tsx` | Provider 조립, 임시 셸 |
| `src/i18n/*` | `detectLocale`, `formatMessage`, 사전(ko/en), Context/Provider/hook |
| `src/theme/*` | `resolveTheme`, `nextPreference`, 시스템 테마 구독, Context/Provider/hook |
| `src/components/{Logo,Button,TopBar}.tsx` | 공통 컴포넌트 |
| `src/styles/global.css` | 디자인 토큰(라이트/다크), 리셋, 레이아웃, 버튼 |
| `worker/index.ts` | `/api/health`, `/api/*` 404 |
| `worker-configuration.d.ts` | `wrangler types` 생성물 |
| `README.md` | 프로젝트 안내 |
| 테스트 4개 | 로케일 감지, 메시지 치환, 사전 키 일치, 테마 해석 |

## 주요 구현

- **서비스 이름 단일 출처**: `shared/config.ts`를 앱·Worker·Vite 설정이 모두 읽는다. `index.html`은 Vite 플러그인이 `%SERVICE_NAME%`을 치환한다.
- **i18n**: `ko.ts`가 키의 원본이고 `en.ts`는 `satisfies Record<MessageKey, string>`로 키 누락을 컴파일 시점에 잡는다. `t()`는 `{name}` 치환을 지원한다. 로케일이 바뀌면 `<html lang>`을 갱신한다.
- **테마**: `useSyncExternalStore`로 `prefers-color-scheme`를 구독하고, 해석 결과를 `html[data-theme]`와 `<meta name="theme-color">`에 반영한다. 선택 값은 상태에만 있고 새로고침하면 `system`으로 돌아간다.
- **Worker 라우팅**: `run_worker_first: ["/api/*"]`로 API만 Worker가 받고, 나머지는 정적 자산 → 없으면 `index.html`.
- **린트 호환**: 컴포넌트 파일에서 hook을 함께 export하면 `react/only-export-components` 경고가 나므로 Context, Provider, hook을 파일로 분리했다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| `src/app/config.ts` | `shared/config.ts` | Worker가 `src/` 안을 import하는 것보다 공용 폴더가 경계가 명확하다. |
| 언급 없음 | `vite.config.ts`, `worker/index.ts`는 `./shared/config.ts`처럼 확장자를 붙여 import | `tsconfig.node.json`이 `module: nodenext`라 확장자 없는 상대 import가 오류. `allowImportingTsExtensions`가 켜져 있어 `.ts` 확장자가 가장 단순하다. |
| `observability` 언급 없음 | `enabled: false` | 개인정보 원칙. 필요 시 켜도록 주석으로 안내. |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 (오류 0) |
| 린트 | `npm run lint` | 경고 0, 오류 0 |
| 단위 테스트 | `npm test` | 4 파일 11 테스트 통과 |
| 빌드 | `npm run build` | `dist/client/*`, `dist/worker/index.js`, `dist/worker/wrangler.json` 생성. 출력 설정에 `assets.directory: ../client`, `run_worker_first` 유지 확인 |
| 개발 서버 | `npm run dev` | 셸 렌더링. `GET /api/health` → 200 JSON, `GET /api/nope` → 404 JSON, `GET /some/deep/path` → 200 (SPA 폴백) |
| 브라우저 확인 | 수동 | 한국어·다크 자동 감지. English 전환, 테마 순환(시스템→라이트) 동작. `localStorage`·`sessionStorage`·쿠키 비어 있음. 모바일(375px) 레이아웃 정상 |
