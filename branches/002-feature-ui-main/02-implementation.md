# 002 feature/ui-main — 구현 문서

## 요약

메인 화면(로고, 안내, 시작 버튼)과 메인 → 녹음 → 생성 → 결과 흐름의 뼈대를 만들었다.
흐름은 라우터 없이 `useState<FlowStep>`와 순수 함수 `canTransition`으로 관리한다. 녹음·생성·결과는 자리표시 화면이며 003~005에서 교체한다.
1차 리뷰 반영(커밋 `952c0cb`)과 2차 리뷰 반영(리듀서 전환)까지 포함한 최종 상태를 기록한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/app/flow.ts` | `FLOW_STEPS`/`FlowStep`, `PROGRESS_STEPS`, `canTransition`, `FlowState`/`flowReducer` |
| `src/app/flow.test.ts` | 전이 규칙·리듀서 테스트 7개 |
| `src/app/FlowContext.ts` | `hasNavigated` 컨텍스트. 첫 로드와 화면 전환을 구분 |
| `src/App.tsx` | `useReducer(flowReducer)`, `Fragment key={step}`로 화면 재마운트 |
| `src/components/Screen.tsx` | 화면 래퍼. 마운트 시 스크롤 초기화, 화면 전환 후에만 제목(`h1[tabindex=-1]`)에 초점 |
| `src/components/StepIndicator.tsx` | 녹음·생성·결과 진행 표시(`aria-current="step"`, 완료 단계 숨김 텍스트) |
| `src/screens/LandingScreen.tsx` | 로고 96px, 서비스 이름, 태그라인, 3단계 안내, 시작 버튼, 힌트/미지원/HTTPS 안내 |
| `src/screens/{Record,Generating,Result}Screen.tsx` | 자리표시 화면. 제목·안내·이동 버튼만 |
| `src/i18n/messages/{ko,en}.ts` | 메시지 22개 추가, `shell.placeholder` 삭제 |
| `src/styles/global.css` | 임시 히어로 스타일 삭제, `--danger` 토큰, `.visually-hidden`, 화면 공통·진행 단계·메인 화면 스타일 추가 |

## 주요 구현

- **전이 규칙 한 곳**: `TRANSITIONS` 표가 유일한 출처다. `App`은 `useReducer(flowReducer)`로 흐름 상태를 들고, 리듀서가 **현재 단계**를 기준으로 `canTransition`이 참일 때만 `{ step, hasNavigated: true }`로 바꾼다. 비동기 콜백이 뒤늦게 `navigate`를 불러도 건너뛰기가 생기지 않으며, `dispatch`는 안정적이라 자식에 그대로 넘긴다. 개발용 경고는 리듀서 순수성을 위해 두지 않는다.
- **화면 전환 접근성**: `Fragment key={step}`로 단계가 바뀔 때마다 화면을 새로 마운트한다. `Screen`은 `FlowContext.hasNavigated`가 참일 때만 제목에 초점을 준다. 첫 로드에서는 초점을 건드리지 않아 Tab 순서가 상단 바(언어·테마)부터 시작한다. 초점 링은 `:focus-visible`일 때만 보인다.
- **마이크 가능 여부 사전 확인**: `isSecureContext`가 아니면 HTTPS 안내, `getUserMedia`나 `MediaRecorder`가 없으면 미지원 안내를 `role="status"`로 보여주고 시작 버튼을 비활성화한다. 권한 요청은 003에서 한다.
- **진입 애니메이션**: `.screen`에 240ms 페이드·슬라이드. `prefers-reduced-motion`이면 전역 규칙으로 꺼진다.
- **자리표시 화면 버튼**: 녹음 화면의 "생성하기"와 생성 화면의 "결과 보기"는 흐름을 끝까지 눌러 볼 수 있게 둔 임시 버튼이다. 003·004에서 실제 동작으로 바뀐다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| `FLOW_ORDER` | `FLOW_STEPS` + `PROGRESS_STEPS` | 전체 단계와 진행 표시용 단계를 분리. `satisfies readonly FlowStep[]`로 어긋나면 컴파일 오류. |
| `getUserMedia` 존재만 확인 | `isSecureContext`, `getUserMedia`, `MediaRecorder` 세 가지 확인 | HTTP 주소와 `MediaRecorder` 미지원 브라우저를 녹음 화면 전에 걸러내기 위해. |
| `ScreenProps { onNavigate }` 공통 | `LandingScreen`만 `onStart` | 메인은 이동 가능한 단계가 하나뿐이라 의도가 드러나는 이름이 낫다. |
| 단계가 바뀌면 제목에 초점 | 첫 로드는 제외(`FlowContext.hasNavigated`) | 리뷰 M1. 첫 방문 키보드 동선이 상단 바를 건너뛰는 문제. |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 |
| 린트 | `npm run lint` | 경고 0, 오류 0 |
| 단위 테스트 | `npm test` | 5 파일 17 테스트 통과 |
| 빌드 | `npm run build` | 통과 |
| PC · 다크 · 한국어 | 수동 | 메인 렌더링. 시작하기 → 녹음(제목에 초점, 진행 1/3) → 생성하기 → 생성(2/3) → 결과 보기 → 결과(3/3, 앞 단계 완료) → 처음으로 → 메인(진행 표시 숨김, 제목에 초점) |
| 첫 로드 초점 | 수동 | 새로고침 직후 `document.activeElement`가 `body`. 첫 Tab이 상단 바 "한국어"로 이동 |
| 전환 후 초점 | 수동 | 시작하기 클릭 후 `h1`에 초점, 마우스 조작이라 outline 없음(`:focus-visible` 아님). 뒤로 클릭 후 메인 `h1`에 초점 |
| 모바일 375px · 라이트 · 한국어 | 수동 | 로고, 3단계 카드, 가로 가득 시작 버튼, 힌트, 푸터가 한 화면에 들어감. 단계 번호 색 `color-mix` 적용 확인 |
| 모바일 375px · 라이트 · 영어 | 수동 | English 전환 시 모든 문구 교체. 두 줄로 접히는 안내 문구에서 번호가 첫 줄에 정렬 |
