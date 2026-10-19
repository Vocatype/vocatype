# 002 feature/ui-main — 리뷰 문서

리뷰 대상: `feature/002-ui-main` → `main` 전체 diff.
리뷰 방식: 001과 같다. 별도 리뷰 에이전트가 설계·구현 문서와 코드를 읽고 검증 명령을 직접 실행한 뒤 보고, 구현자가 반영.

## 1차 리뷰

### 체크리스트

| 항목 | 결과 |
| --- | --- |
| 전이 규칙, 타입, 테스트 | 문제 없음 |
| 개인정보 원칙 (저장소·쿠키·외부 요청) | 문제 없음 |
| 접근성 | **결함 발견** (M1, m1, m2, m3) |
| i18n 문구 | 영어 문구 구분 부족 (m4) |
| 문서와 코드 일치 | 불일치·미기록 (M2, m6) |
| typecheck / lint / test / build | 모두 통과 |

### 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 (커밋 `952c0cb`) |
| --- | --- | --- | --- | --- |
| M1 | major | `Screen.tsx` | 첫 로드에서도 `h1`에 초점이 가서 키보드 사용자의 첫 Tab이 상단 바를 건너뜀 | `FlowContext.hasNavigated`를 두고 화면 전환 후에만 초점 |
| M2 | major | `02-implementation.md` | 모바일·라이트·영어 전환 검증이 존재하지 않는 문서를 참조하며 미기록 | 실제로 확인하고 결과를 구현 문서에 직접 기록 |
| m1 | minor | `global.css` | `.screen__title { outline: none }`이 키보드 초점 링까지 제거 | `:focus:not(:focus-visible)`에만 적용 |
| m2 | minor | `LandingScreen.tsx` | 정적 안내에 `role="alert"`; HTTP 주소일 때 "미지원"으로 잘못 안내 | `role="status"`, `isSecureContext` 확인 후 HTTPS 안내 분리 |
| m3 | minor | `global.css` | `.howto__num` 라이트 테마 대비 약 3.9:1로 AA 미달 | 글자색을 `color-mix(in srgb, var(--accent) 75%, var(--fg))`로 |
| m4 | minor | `en.ts` | "Start over"/"Try again"이 처음으로/다시 녹음을 구분하지 못함, "Generate"/"Result" 품사 불일치 | "Back to start" / "Record again" / "Generating" |
| m5 | minor | `App.tsx` | state updater 안의 `console.warn`이 StrictMode에서 중복, 순수성 위반 | 현재 `step`을 읽어 updater 밖에서 판단 |
| m6 | minor | 문서 | `FLOW_ORDER`→`FLOW_STEPS`, `MediaRecorder` 추가 확인이 "달라진 점"에 없음 | 표에 추가 |
| m7 | minor | `flow.ts` | 미사용 `ProgressStep` export | 삭제 |
| nit | nit | `StepIndicator.tsx` | className 공백, 완료 단계가 시각으로만 구분, 불필요한 캐스트 | 배열 join, 숨김 텍스트 "완료", `findIndex` |
| nit | nit | `ko.ts` | "보이스 초상"이 태그라인 용어와 다름 | "나의 목소리 초상" |
| nit | nit | `global.css` | 두 줄 안내에서 번호가 중간에 뜸 | `align-items: flex-start` + 텍스트 상단 여백 |
| nit | nit | `App.tsx` | 재마운트가 컴포넌트 타입 차이에 암묵적으로 의존 | `Fragment key={step}` 명시 |

### 1차 결론

**수정 필요.** M1·M2·m1 반영 후 2차 리뷰. (나머지도 같은 커밋에 반영함)

### 1차 반영 후 구현자 확인

- typecheck / lint / test(14) / build 통과
- 첫 로드: `activeElement`가 `body`, 첫 Tab → "한국어". 시작하기 클릭 후 `h1`에 초점(outline 없음). 뒤로 → 메인 `h1`에 초점
- 375px 라이트 한국어·영어 화면 확인, 번호 색 `color(srgb 0.35 0.30 0.77)`로 어두워짐

## 2차 리뷰

대상: 커밋 `952c0cb`, `4343258`. 리뷰 에이전트가 검증 4종을 다시 실행하고 1차 13건의 해결 여부를 확인.

### 1차 항목 해결 여부

M1, M2, m1~m7, nit 전부 해결 확인. `hasNavigated`가 `setStep`과 함께만 켜져 플래그 변경 시점이 항상 재마운트와 일치함, 대비 수치(라이트 ≈ 5.5:1, 다크 ≈ 6.5:1), 문서 기록의 정확성 확인.

### 신규 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| A | minor(잠복) | `App.tsx` | `useCallback([step])`은 언마운트된 화면이 쥔 옛 `navigate`가 옛 `step`으로 판단해, 004의 비동기 완료 콜백이 `record`에서 `result`로 건너뛸 수 있음 | `useReducer(flowReducer)`로 전환. 리듀서가 현재 단계 기준으로 전이를 판단. 뒤늦은 전이가 막히는 테스트 추가 |
| B | nit | `Screen.tsx` | effect 의존성 `[hasNavigated]`의 불변식이 코드에서 읽히지 않음 | 주석으로 불변식 기록. 리듀서 전환으로 코드에서도 보장 |
| C | nit | `LandingScreen.tsx` | className 뒤쪽 공백 패턴 재발 | 배열 `filter(Boolean).join` |
| D | nit | `global.css` | `.visually-hidden`과 `.topbar__name` 400px 규칙 중복, 경고색 하드코딩 | `--danger` 토큰 추가·사용. 400px 규칙은 미디어 쿼리 조건부라 클래스 재사용이 불가해 보류 |
| E | nit | `App.tsx` | `value={{ hasNavigated }}`가 매 렌더 새 객체 | 리듀서 상태 객체를 그대로 전달 |

### 2차 결론

**병합 가능.** A~C·E와 D의 토큰 부분을 반영했고 테스트 17개 통과. 코드 변경은 전이 판단 위치만 바뀌었고 화면 동작은 같다(브라우저에서 시작 → 녹음 → 생성 → 취소 → 녹음 흐름과 초점 이동 재확인).

## 최종

- 반영 커밋: 2차 반영 `fix(ui-main)` 커밋
- 병합: `git merge --no-ff feature/002-ui-main` → main
- 브랜치 삭제: `git branch -d feature/002-ui-main`
