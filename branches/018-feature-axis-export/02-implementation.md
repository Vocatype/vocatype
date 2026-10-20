# 018 feature/axis-export — 구현 문서

## 요약

결과 화면에 **보정용 내보내기(개발용)** 카드를 더했다. URL 쿼리 `?calibrate=1`로 연 세션에서만 화면 맨 아래에 보이고, "JSON 내려받기"를 누르면 녹음 한 번의 분석 결과(원시 특징·여섯 축·타입 코드·f0 정규화 밝기 후보·축 범위 스냅샷)가 `vocatype-calib-<locale>-<typeCode>-<seed>.json` 한 파일로 기기에 저장된다.
음성·포락선·시각·UA 같은 것은 들어가지 않고, 서버 요청도 저장소 사용도 없다(브라우저에서 클릭 전후 요청 0건, `localStorage`·`sessionStorage`·쿠키 비어 있음 확인). 분석 코드의 수치·규칙은 바꾸지 않았다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/features/export/calibration.ts` | 신설. `buildCalibrationExport`(프로필 + 캡처의 글 id·언어·길이 → 레코드), `normalizedTilt`(`tiltMedian / (2π·f0Median / sampleRate)`, f0 없으면 null), `calibrationFilename`, `serializeCalibration`(2칸 들여쓰기 + 끝 줄바꿈), `calibrationBlob`(`application/json`), `isCalibrationEnabled`(`calibrate=1`만 참). 상수 `CALIBRATION_SCHEMA`, `CALIBRATION_SCHEMA_VERSION = 1`, `CALIBRATION_QUERY_KEY` |
| `src/features/export/calibration.test.ts` | 신설. 테스트 15개(아래 표) |
| `src/features/analysis/version.ts` | 신설. `ANALYSIS_VERSION = 1`. 특징 계산이나 `AXIS_RANGES`가 바뀌면 올린다 |
| `src/App.tsx` | 첫 렌더에 `isCalibrationEnabled(window.location.search)`를 한 번 읽어 `ResultScreen`의 `calibration` prop으로 넘김 |
| `src/screens/ResultScreen.tsx` | `calibration?: boolean`(기본 false). 참이면 면책 문구 뒤에 `section.card.card--dev`(제목·안내·버튼·`role="status"` 상태 문구). 버튼 → `buildCalibrationExport` → `calibrationBlob` → 기존 `downloadBlob` → 상태 문구에 파일 이름. 예외가 나면 `is-error` 상태 문구로 다시 시도 안내 |
| `src/screens/ResultScreen.test.tsx` | `render()`에 `calibration` 옵션. 테스트 3개 추가(기본에 카드 없음, ko/en 카드 구조, 결과 없음이면 플래그가 있어도 없음) |
| `src/i18n/messages/ko.ts`, `en.ts` | `result.calibration.title`·`note`·`export`·`saved`·`failed` |
| `src/styles/global.css` | `.card--dev`(점선 테두리, 그림자 없음) |
| `branches/018-feature-axis-export/` | 설계·구현·리뷰 문서 |

## 주요 구현 내용

- **순수 함수와 화면의 분리**: `calibration.ts`에는 DOM·네트워크·저장소 접근이 없다. 다운로드는 PNG 저장과 같은 `downloadBlob`(`<a download>` + `URL.createObjectURL`, 10초 뒤 해제)만 쓴다.
- **음성에 손대지 않음**: `buildCalibrationExport`의 캡처 매개변수 타입은 `CalibrationCapture = { script: Pick<Script,'id'|'locale'>; recording: Pick<Recording,'durationMs'> }`라 `recording.blob`을 타입에서부터 받지 않는다. 테스트는 `blob` getter가 예외를 던지는 실제 `Capture`를 넘겨 함수가 Blob을 읽지 않음을 확인한다.
- **스키마 고정**: 최상위 13개 키와 `features`의 17개 키(= `VoiceFeatures` 17개 − `envelope` + `envelopeLength`)를 테스트가 목록으로 고정한다. `features`는 구조 분해가 아니라 **허용 목록**으로 필드를 하나씩 옮기므로, `VoiceFeatures`에 필드가 늘면 `CalibrationFeatures` 타입이 그 필드를 요구해 먼저 컴파일이 실패하고 테스트도 실패한다. 새 필드가 음성·시계열이 아닌지 확인하고 `schemaVersion`을 올린 뒤에만 더할 수 있다. 음성 부재 테스트는 금지 키 14개와 "길이 3 이상의 배열 없음"도 검사한다.
- **전역 상수 보호**: `axisRanges`는 `structuredClone(AXIS_RANGES)`로 복사한다. 레코드를 받은 쪽이 바꿔도 축 계산에 쓰는 상수는 변하지 않는다(테스트로 고정).
- **f0 정규화 밝기 후보**: `spectralTilt`가 순음에서 `2π·f/fs`에 비례하는 성질(dsp.ts)을 테스트로 확인했다. 125Hz 순음(16kHz, 1024 창에 정확히 8주기) → `tiltNormalized ≈ 1.000`, 배음 1 : 0.5 : 0.3을 더하면 > 1.3(이론값 ≈ 1.45).
- **플래그는 App에서 한 번**: `useState(() => isCalibrationEnabled(window.location.search))`. 라우터가 없어 `location.search`는 녹음 → 생성 → 결과까지 유지되고, 언어·테마 전환도 URL을 건드리지 않는다. 어디에도 저장하지 않으므로 쿼리 없이 다시 열면 바로 사라진다.
- **상태 문구**: 내려받은 뒤 `저장했어요: <파일 이름>`을 `role="status"`로 보여 수집자가 파일 이름을 바로 확인할 수 있다. 언어를 바꿔도 파일 이름은 유지된다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| `ResultScreen`이 마운트 때 `window.location.search`를 읽음 | `App`이 읽어 `calibration` prop으로 넘김. `ResultScreen`은 prop만 봄 | 화면 컴포넌트가 전역을 읽지 않아 정적 렌더 테스트가 플래그 켜짐·꺼짐을 모두 검사할 수 있다(설계는 꺼짐만 테스트할 계획이었다) |
| 테스트 픽스처를 `satisfies CalibrationCapture`로 | 실제 `Capture` 타입의 픽스처(+ `CalibrationCapture`로 대입 가능 확인) | `satisfies`는 초과 속성(`mimeType`, `blob`)을 거부한다. 화면이 넘기는 모양 그대로 넣는 편이 "Blob을 읽지 않는다"는 의도에도 맞다 |
| 브라우저 확인은 `?calibrate=1` 흐름만 | 플래그 없는 흐름도 한 번 더 돌려 카드 부재 확인 | 설계 검증 계획 4의 마지막 문장대로 |
| `features`는 `envelope`를 뺀 나머지를 구조 분해로 통째로 | 필드를 하나씩 옮기는 허용 목록 | 1차 리뷰 #4. 구조 분해는 앞으로 추가되는 필드(예: 프레임별 배열)가 자동으로 JSON에 들어가고, 막는 장치가 테스트 목록뿐이었다. 허용 목록은 타입 검사 단계에서 결정을 강제한다 |
| 메시지 4개 | + `result.calibration.failed` | 1차 리뷰 #3. 내보내기 핸들러에 try/catch가 없어 예외가 나면 상태 문구가 빈 채로 남았다. `save()`와 같은 꼴로 실패 문구를 보인다 |
| `axisRanges: AXIS_RANGES`(참조) | `structuredClone(AXIS_RANGES)` | 1차 리뷰 #8. `as const`는 타입에서만 읽기 전용이라 받은 쪽이 바꾸면 전역 상수가 바뀐다 |
| 음성 금지 키 8개 | 14개(`frames`·`waveform`·`spectrum`·`buffer`·`signal`·`url` 추가) + 배열 길이 ≤ 2 검사 | 1차 리뷰 #5 |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 종료 코드 0 |
| 린트 | `npm run lint` | 종료 코드 0, 경고 0 |
| 단위 테스트 | `npm test` | 종료 코드 0. 30 파일 212 테스트 통과(이전 29 파일 193 + `calibration.test.ts` 15개 + `ResultScreen.test.tsx` 4개(ko/en `it.each` 포함)) |
| 빌드 | `npm run build` | 종료 코드 0 |

### 단위 테스트 목록 (`calibration.test.ts`)

| 테스트 | 확인하는 것 |
| --- | --- |
| 최상위 키 집합과 식별자가 스키마 1판대로 고정된다 | 13개 키의 순서까지, `schema`·`schemaVersion`·`analysisVersion`, `derived` 키, `axisRanges`가 `AXIS_RANGES`와 같은 값 |
| axisRanges는 전역 상수의 복사본 | 참조가 다르고(`pace`까지), 레코드의 `pitch[0]`을 바꿔도 `AXIS_RANGES.pitch[0]`은 85 |
| features는 VoiceFeatures에서 envelope만 뺀 전체 + envelopeLength | 17개 키 목록 고정, 픽스처와 값 일치, `envelopeLength` 4 |
| 여섯 축·타입 코드·씨앗·품질과 캡처의 언어·글 id·녹음 길이 | 값 그대로, `axes` 키 6개 |
| 캡처가 없으면 화면 언어와 분석 길이 | `locale: 'en'`, `scriptId: null`, `durationMs: 12000` |
| 입력이 같으면 JSON 문자열도 같다 | 결정성 |
| 음성 Blob을 읽지 않고 음성 키가 없다 | `blob` getter가 던지는 캡처로 예외 없음, 모든 경로에서 `envelope`·`blob`·`audio`·`samples`·`pcm`·`recording`·`mimeType`·`previewUrl`·`frames`·`waveform`·`spectrum`·`buffer`·`signal`·`url` 없음, JSON 안의 모든 배열 길이 ≤ 2(축 범위 쌍뿐) |
| 식별 정보 키가 없다 | 모든 키의 마지막 조각이 `time`·`date`·`stamp`·`agent`·`address`·`device`·`platform`·`user`·`mail`·`ip`·`geo`·`location`·`name`·`browser`·`os`에 걸리지 않음 |
| JSON은 숫자·문자열·null·배열·객체만 담고 작다 | `JSON.parse(text)` 왕복 동일, 2000자 미만 |
| `normalizedTilt` 수식 | 픽스처 `0.18 / (2π·150/16000) ≈ 3.0558` |
| f0가 없으면 null | `f0Median: 0`, `sampleRate: 0`, low-signal 프로필 |
| 순음 ≈ 1, 배음이 더해지면 커진다 | 위 "주요 구현 내용" 참고 |
| 파일 이름 | `vocatype-calib-ko-WFME-2893421043.json`, 정규식 |
| Blob | `application/json`, 본문 = `serializeCalibration`, `{\n  "schema"`로 시작, `}\n`으로 끝 |
| `isCalibrationEnabled` | `?calibrate=1`·`?lang=ko&calibrate=1`만 참, ``·`0`·값 없음·`true`·다른 키는 거짓 |

### 브라우저 확인 (`.claude/launch.json`의 `dev`, `http://localhost:5173`, 내장 브라우저, 다크·한국어)

마이크가 없어 `navigator.mediaDevices.getUserMedia`를 합성 말소리 스트림(자음 잡음 60ms + 배음 1 : 0.5 : 0.3 모음, 140Hz ± 12% 음절별 흔들림, 5음절/초, 8음절마다 0.4초 쉼, 강세 [1, 0.6, 0.8], 15.8초 반복)으로 바꿔 실제 녹음·디코딩·분석 경로를 그대로 탔다.

| 항목 | 결과 |
| --- | --- |
| `/?calibrate=1` → 시작 → 『향수』 녹음 0:22 → 생성 → 결과 | `WLQE · 햇살 아래 산책자`, W 74% · L 67% · Q 56% · E 58%, 평균 음높이 141Hz · 분당 327음절. `/api/config` 200, `/api/portrait` 503(자리표시), `/api/reading` 200 |
| 카드 노출 | 면책 문구 뒤 맨 아래에 점선 카드 "보정용 내보내기 (개발용)", 안내 문구, "JSON 내려받기" 버튼. 저장 이미지(`renderCard`)에는 영향 없음 |
| 버튼 클릭 | `<a download="vocatype-calib-ko-WLQE-2744110069.json" rel="noopener" href="blob:…">` 클릭 1회. 상태 문구 `저장했어요: vocatype-calib-ko-WLQE-2744110069.json`. 파일이 디스크에 저장됨(1,454바이트, 내장 브라우저는 작업 폴더에 저장했고 확인 뒤 삭제) |
| JSON 내용 | 스키마 1판 그대로. `locale: "ko"`, `scriptId: "ko-hyangsu"`, `durationMs: 22001`, `quality: "ok"`, `typeCode: "WLQE"`, `seed: 2744110069`, 축 6개, `features` 17개(`envelope` 없음, `envelopeLength: 665`), `derived.tiltNormalized: 1.612`(= `0.0896 / (2π·141.48/16000)` 재계산 일치), `axisRanges` 스냅샷. 시각·UA·IP 없음 |
| 클릭 전후 네트워크 | `fetch`·`XMLHttpRequest`·`sendBeacon` 호출 0건, `performance` 리소스 항목 62 → 62(변화 없음). 서버 요청 없음 |
| 저장소 | 클릭 전후 모두 `localStorage.length 0`, `sessionStorage.length 0`, `document.cookie ""` |
| 언어 전환(English) | 카드가 "CALIBRATION EXPORT (DEVELOPER) / Saves only the analysis numbers … / Download JSON / Saved: vocatype-calib-ko-WLQE-2744110069.json"으로 바뀌고 파일 이름은 유지 |
| `/`(쿼리 없음) → 같은 흐름(0:07 녹음) → 결과 | `WLQE`. `.card--dev` 0개, "보정용 내보내기"·"JSON" 문구 없음, 버튼은 이미지로 저장·다시 하기·처음으로뿐, `role="status"` 1개, 저장소 비어 있음 |
| 1차 리뷰 반영(허용 목록·try/catch·`structuredClone`) 뒤 `/?calibrate=1` → 『청포도』 0:08 → 결과 → JSON 내려받기 | `WFQE`. `vocatype-calib-ko-WFQE-4241510302.json`(1,457자): 최상위 13개 키 순서 동일, `features` 17개(`envelope` 없음, `envelopeLength: 230`), `scriptId: "ko-cheongpodo"`, `durationMs: 8021`, `tiltNormalized: 1.625`, `axisRanges.pitch: [85, 255]`. 상태 문구 `저장했어요: …`, 클릭 전후 리소스 항목 62 → 62, 저장소·쿠키 비어 있음 |

합성 스트림의 수치 자체(속도 +9%, 밀도 0.72)는 004 때 관찰과 같은 경향이며 이 작업의 검증 대상은 아니다.

## 수집 방법 (보정용 녹음 모으기)

실제 보정은 녹음이 모인 뒤 별도 브랜치에서 한다. 아래는 수집자가 따를 절차다.

### 참가자와 환경

- **언어별 10명 이상**(한국어 글은 한국어 화자, 영어 글은 영어 화자). brightness·pace 범위가 언어별이므로 한쪽만 모으면 그 언어만 보정할 수 있다. 성별·연령대가 한쪽으로 쏠리지 않게 모은다(온도 축이 성별 분류기가 되지 않는지 보려면 양쪽이 필요하다).
- **조용한 실내**, 평소 말하는 거리에서 기기 내장 마이크로. 이어폰 마이크를 쓰면 두 번 모두 같은 것으로.
- 같은 참가자의 두 녹음은 **같은 기기·같은 브라우저·같은 자리**에서 이어서 한다(재현성 비교가 목적).
- 기기는 참가자마다 달라도 된다(실제 사용 분포에 가깝다). 다만 `autoGainControl`이 켜져 있어 `rmsMean`은 기기 사이에 비교할 수 없다. 상대 지표(`rmsVariation`, `speechRatio`)만 쓴다.

### 참가자 한 명의 절차

1. 수집자가 보낸 링크 `https://vocatype.hs827.workers.dev/?calibrate=1`(로컬 확인이면 `http://localhost:5173/?calibrate=1`)을 **그 기기의 브라우저**로 연다. 쿼리가 빠지면 카드가 보이지 않으니 링크를 그대로 쓴다.
2. 시작하기 → 글 하나를 고른다(**같은 글을 두 번** 읽을 것이므로 제목을 기억한다. 한 언어에 글이 6편이라 "다른 글"을 눌러 맞출 수 있다).
3. 평소 말하듯 끝까지 읽는다(10~30초). 생성하기 → 결과.
4. 결과 화면 맨 아래 "보정용 내보내기 (개발용)" 카드의 **JSON 내려받기**를 누른다. 상태 문구의 파일 이름(`vocatype-calib-<언어>-<타입>-<씨앗>.json`)을 확인한다.
5. "다시 하기" → 같은 제목이 나올 때까지 "다른 글" → 2~4를 한 번 더. 두 번째 파일은 씨앗이 달라 이름이 다르다.
6. 두 파일을 수집자에게 보낸다. 파일에는 음성·이름·시각이 없다. 파일 이름도 바꾸지 않는다.

### 파일 모으기

- 저장소 **밖**의 폴더에 `calib/<locale>/p<참가자 번호>/` 로 둔다(예: `calib/ko/p03/vocatype-calib-ko-WLQE-….json` 두 개). 참가자 번호와 사람의 대응표는 만들지 않거나, 만들면 수집자만 보관하고 저장소에 넣지 않는다.
- 수집자가 따로 적어 두는 것(파일에는 없음): 참가자 번호, 기기 종류(폰/노트북·내장/이어폰 마이크), 두 번 사이에 달라진 조건, 선택으로 성별·연령대(온도 축이 성별 분류기가 되지 않았는지 보는 용도로만).
- 참가자에게 미리 말한다: 파일에는 음성·이름·시각이 없고 분석 수치만 있다는 것, 수집자가 따로 적는 항목이 무엇인지. 보정 브랜치의 02 문서에 집계 표를 적은 뒤에는 메모와 원본 JSON을 지운다(보존 기한 = 보정 작업 종료).
- 받은 파일은 `schema === "voice-axis-calibration"`, `schemaVersion`, `analysisVersion`을 확인하고 `quality !== "ok"`인 파일은 따로 둔다(재녹음 요청).
- 모인 파일을 저장소에 커밋하지 않는다. 보정 브랜치의 02 문서에는 **집계 표**(백분위·분포)만 적는다.

## 보정 방법 (모인 JSON → `AXIS_RANGES`)

목표: 각 축의 중앙값이 0.5 근처(0.45~0.55)에 오고 16타입이 고르게 나오도록(한 타입이 25%를 넘지 않게) 범위를 옮긴다. brightness·pace는 **언어별**로 본다.

1. **읽기**: 폴더의 JSON을 모두 읽어 행 하나로 편다(`locale`, `scriptId`, 참가자 번호, 회차, `features.*`, `axes.*`, `derived.tiltNormalized`, `typeCode`). `quality !== "ok"` 제외. `analysisVersion`이 다른 파일이 섞이면 같은 판끼리만 묶는다.
2. **재현성부터**: 같은 참가자의 두 회차에서 축별 `|Δ|`의 중앙값과 최대값, 타입 글자가 바뀐 축의 빈도를 본다. 어느 축의 `|Δ|` 중앙값이 0.1을 넘으면 범위를 옮기기 전에 그 축의 특징 추출(쉼 판정, 봉우리 검출 등)이 불안정한 것이므로 004 쪽 과제로 분리한다.
3. **원시 특징 분포**: 언어별로 `f0Median`, `tiltMedian`, `tiltNormalized`, `speechRatio`, `syllableRate`, `f0Variation`, `rmsVariation`의 p10·p50·p90을 구한다(참가자당 두 회차 평균을 한 표본으로).
4. **새 범위**: 선형 사상 축(`brightness`, `density`, `pace`, `f0Variation`, `rmsVariation`)은 `[p10, p90]`을 새 범위로 두면 중앙값이 0.5 근처가 되고 양 극단 10%가 0·1로 잘린다. `pitch`는 로그 사상이라 `[p10, p90]`을 그대로 쓰되 기하 중앙값이 범위의 기하 중앙(`√(low·high)`)에 오는지 본다. 표본이 10명뿐이면 p10·p90 대신 `중앙값 ± 1.3 × IQR`처럼 덜 흔들리는 추정도 함께 보고 둘이 크게 다르면 표본을 더 모은다.
5. **brightness 지표 선택**: `tiltMedian`과 `tiltNormalized` 각각에 대해 `f0Median`과의 순위 상관(Spearman)을 구한다. 004 문서의 우려대로 `tiltMedian`이 f0에 끌려가면(상관 > 0.5) 상관이 낮은 `tiltNormalized`를 채택하고, `features.ts`에 정규화 값을 더하거나 `axes.ts`의 brightness 입력을 바꾼 뒤 `ANALYSIS_VERSION`을 2로 올린다. 어느 쪽이든 `warmth = 1 − (0.4·pitch + 0.6·brightness)`에서 성별에 따라 W/C가 거의 결정되는지(남녀 각각의 W 비율) 확인한다.
6. **pace·brightness는 언어별**: `AXIS_RANGES.pace`처럼 `brightness`도 언어별 범위가 필요하면 같은 꼴(`{ ko: [...], en: [...] }`)로 바꾼다. 한 언어만 모였으면 그 언어만 갱신하고 다른 언어는 그대로 둔 채 문서에 적는다.
7. **variation**: `f0Variation`·`rmsVariation` 범위를 각각 옮긴 뒤 가중치 0.6/0.4에서 `variation`의 중앙값이 0.5 근처인지 본다.
8. **적용과 확인**: 새 범위로 모인 `features`에서 축과 타입을 다시 계산해(JSON의 `axisRanges`가 아니라 새 범위로) 축별 중앙값과 16타입 분포 표를 만든다. `fix/NNN-axis-ranges` 브랜치에서 `AXIS_RANGES` 갱신 → `axes.test.ts` 기대값 조정 → `ANALYSIS_VERSION` 올림 → 설계·구현·리뷰 문서. 집계 표를 02에 남기고 원본 JSON은 넣지 않는다.

집계는 Node 한 파일로 충분하다(저장소에는 넣지 않는다). 절차 1~3대로 `analysisVersion`이 같은 파일만 쓰고, 참가자 폴더(`p<번호>`)의 회차를 평균해 한 표본으로 세며, 회차 사이 축 차이(`|Δ|`)도 함께 보여 준다. 가짜 파일 7개(ko 참가자 2명 × 2회차 + `analysisVersion: 2`인 파일 1개, en 1명 × 2회차 중 하나는 `low-signal`)로 실행해 제외 규칙(ko 파일 4개·en 1개만 집계)과 출력 형식을 확인했다.

```js
// node summarize.mjs ./calib [analysisVersion=1]  — 언어별 p10/p50/p90. 참가자 폴더(p<번호>)의 회차를 평균해 한 표본으로 센다.
import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
const [root, version = '1'] = process.argv.slice(2)
const files = []
const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) files.push(p) } }
walk(root)
const FEATURES = ['f0Median', 'tiltMedian', 'speechRatio', 'syllableRate', 'f0Variation', 'rmsVariation']
const AXES = ['warmth', 'density', 'pace', 'variation', 'pitch', 'brightness']
// 참가자(폴더 이름 p<번호>)별로 회차를 모은다. quality !== 'ok'와 다른 analysisVersion은 제외.
const byParticipant = new Map()
for (const file of files) {
  const r = JSON.parse(readFileSync(file, 'utf8'))
  if (r.schema !== 'voice-axis-calibration' || r.quality !== 'ok' || String(r.analysisVersion) !== version) continue
  const folder = basename(dirname(file))
  if (!/^p\d+$/.test(folder)) console.warn(`경고: 참가자 폴더 이름이 p<번호>가 아니라 같은 폴더의 파일이 한 참가자로 합쳐진다 — ${file}`)
  const key = `${r.locale}/${folder}`
  byParticipant.set(key, [...(byParticipant.get(key) ?? []), r])
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
const samples = [...byParticipant.entries()].map(([key, takes]) => ({
  locale: key.split('/')[0],
  takes: takes.length,
  features: Object.fromEntries(FEATURES.map((k) => [k, mean(takes.map((r) => r.features[k]))])),
  tiltNormalized: mean(takes.map((r) => r.derived.tiltNormalized ?? NaN)),
  axes: Object.fromEntries(AXES.map((k) => [k, mean(takes.map((r) => r.axes[k]))])),
  // 같은 참가자의 두 회차 사이 축 차이(재현성). 회차가 하나면 NaN.
  delta: Object.fromEntries(AXES.map((k) => [k, takes.length > 1 ? Math.abs(takes[0].axes[k] - takes[1].axes[k]) : NaN])),
}))
for (const locale of ['ko', 'en']) {
  const set = samples.filter((s) => s.locale === locale)
  if (!set.length) continue
  console.log(`\n${locale}: 참가자 ${set.length}명, 파일 ${set.reduce((n, s) => n + s.takes, 0)}개 (analysisVersion ${version})`)
  for (const k of FEATURES) console.log(k.padEnd(14), [0.1, 0.5, 0.9].map((p) => q(set.map((s) => s.features[k]), p).toFixed(3)).join('  '))
  console.log('tiltNormalized', [0.1, 0.5, 0.9].map((p) => q(set.map((s) => s.tiltNormalized).filter(Number.isFinite), p).toFixed(3)).join('  '))
  for (const k of AXES) {
    const deltas = set.map((s) => s.delta[k]).filter(Number.isFinite)
    console.log(`axis ${k}`.padEnd(16), 'p50', q(set.map((s) => s.axes[k]), 0.5).toFixed(3), ' |Δ| p50', deltas.length ? q(deltas, 0.5).toFixed(3) : '-')
  }
}
```

## 알려진 한계

- `envelope`를 빼므로 쉼 판정·봉우리 검출처럼 **특징 추출 자체를 바꾸는 변경**은 모인 JSON으로 재계산할 수 없다. 그런 변경은 재수집이 필요하다. 범위(`AXIS_RANGES`) 조정과 brightness 지표 교체(`tiltMedian` ↔ `tiltNormalized`)는 JSON만으로 된다.
- 씨앗이 회차마다 달라 파일 이름만으로 같은 사람의 두 파일을 짝지을 수 없다. 짝은 수집자의 폴더 구조가 담당한다(개인 식별 정보를 파일에 넣지 않기 위한 선택).
- `autoGainControl`로 `rmsMean`의 절대값은 기기 사이에 비교할 수 없다.
- 내장 브라우저는 첫 확인에서는 다운로드를 작업 폴더에 저장했고, 1차 리뷰 뒤 재확인에서는 파일을 남기지 않았다(앵커 클릭과 Blob 내용은 두 번 모두 가로채어 확인). 일반 브라우저는 다운로드 폴더에 저장하며, 동작(`<a download>`)은 PNG 저장과 같다.
