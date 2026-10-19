# 001 chore/project-setup — 리뷰 문서

리뷰 대상: `chore/001-project-setup` → `main` 전체 diff.
리뷰 방식: 구현자와 별도의 리뷰 에이전트가 설계 문서·구현 문서·코드를 읽고 typecheck/lint/test/build를 직접 실행한 뒤 보고. 구현자가 결과를 검토해 반영.

## 1차 리뷰

### 체크리스트

| 항목 | 결과 |
| --- | --- |
| 런타임 오류, hook 오용, StrictMode 이중 effect | 문제 없음 |
| Cloudflare 배포 구성 (`run_worker_first`, SPA 폴백, 출력 `wrangler.json`, `worker-configuration.d.ts`) | 문제 없음 |
| 개인정보 원칙 (저장소·쿠키·제3자 요청·로그) | 문제 없음. `observability` off, `referrer no-referrer` 확인 |
| i18n 키 일치, 로케일 감지 | 문제 없음 |
| 테마 첫 페인트 | **결함 발견** (아래 #1) |
| 접근성 | 개선 필요 (#2, #7) |
| 문서와 코드 일치 | 불일치 발견 (#5, #6) |
| typecheck / lint / test / build | 모두 통과 |

### 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 (커밋 `ccb5d7c`) |
| --- | --- | --- | --- | --- |
| 1 | major | `global.css`, `index.html`, `ThemeProvider.tsx` | 다크 토큰이 `html[data-theme='dark']`에만 있어 React 마운트 전 첫 프레임이 항상 라이트로 그려짐(FOUC). "방문 시마다 자동 감지" 규칙을 첫 프레임에서 어김 | 색 토큰을 `light-dark()`로 한 번만 정의하고 기본 `color-scheme: light dark`로 둠. 사용자가 고르면 `html[data-theme]`이 `color-scheme`을 고정. `theme-color` 메타를 라이트/다크 두 개로 두고 적용 후 실제 `body` 배경색으로 갱신 |
| 2 | minor | `Logo.tsx` | `role="img"`와 `aria-hidden` 충돌, 그라디언트 `id` 중복(페이지에 로고 2개) | `role` 제거, `useId()`로 id 생성 |
| 3 | minor | `global.css` | 상단 바 `height: 56px` + safe-area 패딩이 `border-box`라 노치 기기에서 콘텐츠 높이가 줄어듦 | `height: calc(var(--topbar-h) + env(safe-area-inset-top))` |
| 4 | minor | `global.css` | `html { font-size: 16px }`가 사용자 글꼴 크기 설정을 무시 | 선언 삭제 |
| 5 | minor | `02-implementation.md` | 이 브랜치에 없는 `.gitignore`/`.claude/` 변경을 기록 | 해당 행 삭제 |
| 6 | minor | `README.md` | 존재하지 않는 `src/app/` 폴더 기재 | 행 삭제 |
| 7 | minor | `TopBar.tsx` | 테마가 순환 버튼이라 언어 컨트롤과 패턴이 다르고 다음 상태를 알 수 없음 | 언어와 같은 3항 segmented(`role="group"` + `aria-pressed`)로 통일. `nextPreference` 제거 |
| 8 | nit | `format.ts` | `name in params`가 프로토타입 키에 참 | `Object.hasOwn` |
| 9 | nit | `index.html` | `lang="ko"`인데 기본 로케일은 `en`; description이 서비스 이름과 같아 무의미 | `lang="en"`, description을 태그라인으로. 로케일 전환 시 `I18nProvider`가 description도 갱신 |
| 10 | nit | `package.json` | Node 버전 고정 없음 | `.node-version`(22), `engines.node >= 22` 추가 |

### 1차 결론

**수정 필요.** #1·#2·#5·#6을 반영한 뒤 2차 리뷰.

### 1차 반영 후 구현자 확인

- `npm run typecheck`, `npm run lint`, `npm test`(10 테스트), `npm run build` 모두 통과
- 브라우저(375px, 시스템 다크): 새로고침 직후 `data-theme="system"` 상태에서 다크로 렌더링, `theme-color` 두 메타가 `rgb(15, 14, 18)`로 갱신, 그라디언트 id `_r_0_`/`_r_1_`로 구분, `localStorage`·쿠키 비어 있음
- 라이트 선택 시 `data-theme="light"`, 배경 `rgb(250, 248, 245)`, 메타 동기화 확인

## 2차 리뷰

대상: 커밋 `ccb5d7c`(1차 반영)와 작업 트리. 리뷰 에이전트가 typecheck/lint/test(10)/build를 다시 실행하고 1차 항목별 해결 여부를 확인.

### 1차 항목 해결 여부

#1~#10 모두 해결 확인. 특히 #1은 `color-scheme: light dark` + `light-dark()` 토큰으로 JS 전 첫 프레임이 시스템 설정을 따르고, `data-theme` 선택 시 `color-scheme`만 고정되어 토큰이 일관되게 바뀌는 것을 확인. `theme-color` 메타 두 개가 같은 값으로 갱신되므로 `media` 속성과 무관하게 맞음. `useId()` 결과(`_r_0_`)가 `url(#…)` 참조에 안전함을 확인.

### 신규 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| A | minor | `02-implementation.md` | 1차 수정으로 바뀐 내용(`nextPreference` 삭제, `data-theme`에 선택값 적용, 테스트 수 10, 3항 테마 컨트롤, description 갱신)이 문서에 반영되지 않음 | 구현 문서를 최종 상태 기준으로 다시 작성 |
| B | nit | `global.css` | 400px 이하에서 `.topbar__name`을 `display: none`으로 숨겨 접근 가능한 브랜드 이름이 사라짐 | visually-hidden 패턴으로 변경 |
| C | nit | `index.html` | `theme-color` 초기값과 영문 태그라인이 CSS·사전과 별도로 하드코딩 | JS가 즉시 덮어쓰므로 보류. 값이 바뀔 때 함께 수정 |
| D | nit | `global.css` | `light-dark()` 폴백 없음 (Safari 17.5 / Chrome 123 이전) | README에 지원 브라우저 기준(2024년 이후 버전) 명시 |
| E | nit | `ThemeProvider.tsx` | effect 의존성의 `systemDark`가 본문에서 쓰이지 않아 "불필요 의존성"으로 제거될 위험 | 의도(OS 테마 변경 시 메타 재동기화)를 주석으로 기록 |

### 2차 결론

**병합 가능.** 조건이던 A를 포함해 B·D·E까지 반영했고 코드 동작 변경은 없다(스타일 1곳, 주석 1곳, README 1줄). C는 보류.

## 최종

- 반영 커밋: 2차 반영 `docs(001)` 커밋
- 병합: `git merge --no-ff chore/001-project-setup` → main
- 브랜치 삭제: `git branch -d chore/001-project-setup`
