# 002 feature/ui-main — 구현 문서

## 요약

메인 화면(로고, 안내, 시작 버튼)과 메인 → 녹음 → 생성 → 결과 흐름의 뼈대를 만들었다.
흐름은 라우터 없이 `useState<FlowStep>`와 순수 함수 `canTransition`으로 관리한다. 녹음·생성·결과는 자리표시 화면이며 003~005에서 교체한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/app/flow.ts` | `FlowStep`, `PROGRESS_STEPS`, `canTransition` |
| `src/app/flow.test.ts` | 전이 규칙 테스트 4개 |
| `src/App.tsx` | 단계 상태, 허용된 전이만 적용하는 `navigate`, 단계별 화면 렌더링 |
| `src/components/Screen.tsx` | 화면 래퍼. 마운트 시 스크롤 초기화 + 제목(`h1[tabindex=-1]`)에 초점 |
| `src/components/StepIndicator.tsx` | 녹음·생성·결과 진행 표시(`aria-current="step"`) |
| `src/screens/LandingScreen.tsx` | 로고 96px, 서비스 이름, 태그라인, 3단계 안내, 시작 버튼, 힌트/미지원 안내 |
| `src/screens/{Record,Generating,Result}Screen.tsx` | 자리표시 화면. 제목·안내·이동 버튼만 |
| `src/i18n/messages/{ko,en}.ts` | 메시지 20개 추가, `shell.placeholder` 삭제 |
| `src/styles/global.css` | 임시 히어로 스타일 삭제, 화면 공통·진행 단계·메인 화면 스타일 추가 |

## 주요 구현

- **전이 규칙 한 곳**: `TRANSITIONS` 표가 유일한 출처다. `App.navigate`는 `canTransition`이 거짓이면 상태를 바꾸지 않고 개발 모드에서만 `console.warn`을 남긴다.
- **화면 전환 접근성**: 단계가 바뀌면 다른 컴포넌트 타입이 마운트되므로 `Screen`의 effect가 매번 실행되어 제목에 초점이 간다. `outline: none`으로 시각적 포커스 링은 숨기고 보조기기에는 전달된다.
- **마이크 지원 사전 확인**: `navigator.mediaDevices.getUserMedia`와 `MediaRecorder`가 모두 있어야 시작 버튼이 활성화된다. 미지원이면 `role="alert"` 문구를 보여준다. 권한 요청은 003에서 한다.
- **진입 애니메이션**: `.screen`에 240ms 페이드·슬라이드. `prefers-reduced-motion`이면 전역 규칙으로 꺼진다.
- **자리표시 화면 버튼**: 녹음 화면의 "생성하기"와 생성 화면의 "결과 보기"는 흐름을 끝까지 눌러 볼 수 있게 둔 임시 버튼이다. 003·004에서 실제 동작으로 바뀐다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| `ScreenProps { onNavigate }` 공통 | `LandingScreen`만 `onStart` | 메인은 이동 가능한 단계가 하나뿐이라 의도가 드러나는 이름이 낫다. 나머지 화면은 설계대로 `onNavigate`. |
| 없음 | `PROGRESS_STEPS`를 `satisfies readonly FlowStep[]`로 선언 | 진행 표시 순서가 `FlowStep`과 어긋나면 컴파일 오류가 나게. |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 |
| 린트 | `npm run lint` | 경고 0, 오류 0 |
| 단위 테스트 | `npm test` | 5 파일 14 테스트 통과 |
| 빌드 | `npm run build` | 통과 |
| 브라우저 (PC, 다크) | 수동 | 메인 렌더링. 시작하기 → 녹음(제목에 초점, 진행 표시 1/3) → 생성하기 → 생성(2/3) → 결과 보기 → 결과(3/3, 앞 단계 완료 표시) → 처음으로 → 메인(진행 표시 숨김) |
| 브라우저 (모바일 375px, 영어) | 수동 | 아래 리뷰 문서의 구현자 확인 참조 |
