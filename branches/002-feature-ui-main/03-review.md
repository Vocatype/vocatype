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
