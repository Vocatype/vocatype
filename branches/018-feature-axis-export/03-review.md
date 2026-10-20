# 018 feature/axis-export — 리뷰 문서

리뷰 대상: `feature/018-axis-export` → `main`(2182a87) 전체 diff.
리뷰 방식: 별도 리뷰 에이전트가 설계·구현 문서와 diff, 관련 기존 코드(`save.ts`, `features.ts`, `axes.ts`, `dsp.ts`, `GeneratingScreen.tsx`)를 읽고 검증 4종을 직접 실행했으며, 체크리스트 A(개인정보 원칙 위반 여부, 최우선)·B(정확성)·C(테스트 실효성)·D(React·접근성)·E(문서)·F(코드 품질)별로 근거 줄을 적어 보고했다. 구현자가 반영.

## 1차 리뷰

대상 커밋: `ccb3021`(설계), `db3fcb6`(구현), `5a28717`(구현 문서). 리뷰어 검증: typecheck·lint·test(30 파일 211 테스트)·build 모두 종료 코드 0.

### 개인정보 원칙 확인(체크리스트 A) — 위반 없음

- 음성: `buildCalibrationExport`는 캡처에서 `script.locale`·`script.id`·`recording.durationMs`만 읽고, 매개변수 타입 `CalibrationCapture`가 `Pick`으로 `blob`·`mimeType`을 타입에서부터 제외. 테스트는 `blob` getter가 예외를 던지는 실제 `Capture`로 호출. `envelope`는 길이만. `ResultScreen`·`App`·`calibration.ts` 어디에도 `recording.blob` 접근 없음.
- 네트워크·저장소: `calibration.ts`·`App.tsx`에 `fetch`/`XMLHttpRequest`/`sendBeacon`/`localStorage`/`sessionStorage`/`cookie`/`indexedDB`/`navigator`/`Date`/`userAgent` 참조 없음. 다운로드는 기존 `downloadBlob`만.
- 노출·자동 다운로드: 다운로드는 버튼 `onClick`에서만, `useEffect`에 없음. 카드는 `calibration` prop이 참일 때만, 기본 false. 플래그는 `App`의 `useState` 초기화로 한 번 읽어 메모리에만. 결과가 없으면 조기 반환이라 카드 불가.
- 식별 정보: 최상위 13개 키에 시각·UA·IP·기기·사용자 값 없음. 파일 이름은 `locale-typeCode-seed`. `seed`는 초상 요청에 이미 보내는 특징 해시.

### 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| 1 | 낮음 | `02-implementation.md` | "`VoiceFeatures` 16개 − envelope + envelopeLength = 17"의 산수 오류(`VoiceFeatures`는 17개) | "17개 − envelope + envelopeLength"로 정정 |
| 2 | 낮음 | `02-implementation.md` 집계 스크립트 | 절차는 "같은 `analysisVersion`끼리, 참가자당 두 회차 평균을 한 표본으로"인데 스크립트는 파일 하나를 표본으로 세고 `analysisVersion`을 보지 않음 | 스크립트를 참가자 폴더(`p<번호>`)별 회차 평균·`analysisVersion` 필터·회차 간 `\|Δ\|` 출력으로 다시 작성. 가짜 파일 7개로 제외 규칙과 출력 확인 |
| 3 | 낮음 | `ResultScreen.tsx` `exportCalibration` | `save()`와 달리 try/catch가 없어 `downloadBlob`이 예외를 던지면 상태 문구가 빈 채로 남음 | try/catch + `result.calibration.failed`(ko/en) + `is-error` 상태 문구 |
| 4 | 제안 | `calibration.ts` | `const { envelope, ...features }` 구조 분해라 `VoiceFeatures`에 앞으로 추가되는 필드(프레임별 배열 등)가 자동으로 JSON에 들어감. 막는 장치가 테스트 목록과 2000자 제한뿐이고 축(명시 나열)과 비대칭 | 특징도 허용 목록으로 필드를 하나씩 옮김. `VoiceFeatures`에 필드가 늘면 `CalibrationFeatures` 타입이 요구해 컴파일부터 실패. 테스트 주석에 "목록 갱신 전 새 필드가 음성·시계열인지 확인" 추가 |
| 5 | 제안 | `calibration.test.ts` | 음성 금지어에 `frames`·`waveform`·`spectrum`·`buffer`·`signal`·`url` 없음 | 추가(14개). JSON 안의 모든 배열 길이 ≤ 2 검사도 추가 |
| 6 | 제안 | `02-implementation.md` 수집 방법 | 참가자에게 따로 적는 항목을 알리는 것과 보존 기한이 없음 | "참가자에게 파일 내용(음성 없음)과 따로 적는 항목을 말한다, 집계 표를 적은 뒤 메모와 원본 JSON을 지운다" 추가 |
| 7 | 제안 | 검증 | 배포 주소(`https://vocatype.hs827.workers.dev/?calibrate=1`)에서 쿼리 유지·카드 노출은 미확인(로컬만) | 병합·배포 뒤 확인해 기록(아래 "최종" 참고). `wrangler.jsonc`의 `not_found_handling: "single-page-application"`과 Worker가 `pathname`으로만 분기하므로 쿼리는 자산 응답에 영향이 없다(2차 리뷰어 확인) |
| 8 | 제안 | `calibration.ts` | `axisRanges: AXIS_RANGES`가 같은 객체 참조. `as const`는 타입에서만 읽기 전용 | `structuredClone(AXIS_RANGES)` + 복사본 테스트(참조 다름, 레코드를 바꿔도 상수 유지) |

### 1차 결론

**병합 가능**(개인정보 원칙 위반·동작 오류 없음). 다만 #1·#2를 병합 전에 고치기를 권해 1~6·8을 모두 반영하고 2차를 받았다.

### 1차 반영 후 구현자 확인

- typecheck / lint / test(30 파일 212 테스트: 복사본 테스트 1개 추가) / build 모두 종료 코드 0
- 브라우저(`?calibrate=1`, 합성 스트림)에서 다시 녹음 → 결과 → JSON 내려받기: `vocatype-calib-ko-WFQE-4241510302.json`, 최상위 13개 키·`features` 17개(`envelope` 없음) 그대로, 클릭 전후 네트워크 요청 없음, 저장소 비어 있음(02 "브라우저 확인" 마지막 행)

## 2차 리뷰

대상: 1차 반영 커밋 `52b9f11`(코드)·`ca6f414`(문서). 리뷰 에이전트가 검증 4종을 재실행하고(30 파일 212 테스트, 모두 종료 코드 0), `git merge-tree --write-tree main HEAD`로 현 main(`2527e47`, 017 병합 뒤)과 충돌이 없음을 확인했다. 허용 목록의 "새 필드 추가 시 컴파일 실패"는 scratch 타입 검사(필드 누락 → TS2322, `envelope` 초과 → TS2353, `VoiceFeatures & { frameEnergies: number[] }`로 새 필드 모사 → TS2322)로, `structuredClone`은 지원 브라우저(Chrome 98·Safari 15.4·Firefox 94부터, README 기준보다 이전)·Node 22·타입 유지(`readonly` 튜플)로, 집계 스크립트는 가짜 파일 7개 재실행과 손계산 대조로 확인했다.

### 1차 항목 해결 여부

1~6·8 모두 해결 확인(02 산수 정정, 스크립트의 판 필터·참가자 회차 평균·`|Δ|`, try/catch와 `is-error`·기존 스타일 일치, 허용 목록 17개 필드 1:1, 금지 키 14개·배열 길이 검사, 참가자 고지·보존 기한, `structuredClone`·복사본 테스트). 7은 보류가 타당(위 표의 근거).

### 신규 발견 사항과 조치

| # | 심각도 | 내용 | 조치 |
| --- | --- | --- | --- |
| a | 낮음 | 03에 "최종" 절이 아직 없음(1차 #7이 참조) | 아래 추가 |
| b | 제안 | 배열 길이 검사가 JSON 문자열 정규식 기반이라 중첩 배열이 오면 단언 메시지 대신 `SyntaxError`로 실패 | JSON을 재귀 순회해 배열(중첩 포함)마다 길이 ≤ 2를 단언하도록 변경 |
| c | 제안 | 집계 스크립트: `p<번호>` 폴더 없이 두면 한 참가자로 조용히 합쳐짐, 회차 3개 이상이면 셋째 무시, 작은 n에서 거친 백분위 | 폴더 이름이 `p<번호>`가 아니면 경고를 찍도록 추가. 나머지는 절차가 2회차를 전제하고 문서용 스크립트라 유지 |
| d | 제안 | 01 (b)의 "구조 분해 … 자동으로 들어간다" 서술이 1차 반영과 다름(02 표에 기록돼 관례상 문제 없음) | 01에 허용 목록으로 바뀌었다는 한 줄과 02 표 참고 추가 |

### 2차 결론

**병합 가능.** a~d 반영 후 검증 4종 재실행(아래 "최종"의 결과).

## 최종

- 2차 반영 뒤 구현자 확인: typecheck / lint / test(30 파일 212 테스트) / build 모두 종료 코드 0. 집계 스크립트는 `calib/ko/` 바로 아래 파일로 경고가 찍히는지 확인.
- 이 세션은 main에 병합하지 않는다(main이 기본 폴더에 체크아웃돼 있어 인수인계 세션 또는 사용자가 실행):
  - 병합: `git merge --no-ff feature/018-axis-export` → main
  - 병합 뒤 검사 4종 재실행
  - 브랜치 삭제: `git branch -d feature/018-axis-export`
- 배포 뒤 확인(1차 #7): `https://vocatype.hs827.workers.dev/?calibrate=1`에서 녹음 → 결과 맨 아래 카드 노출과 JSON 다운로드를 한 번 확인하고 여기에 기록한다.
