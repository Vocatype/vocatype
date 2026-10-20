# 018 feature/axis-export — 설계 문서

## 목표

`AXIS_RANGES`(`src/features/analysis/axes.ts`)는 합성 신호로만 정한 초기값이라 실제 화자 10명 이상의 녹음으로 축 분포를 보고 보정해야 한다(004 구현 문서 "알려진 한계와 보정"). 지금 결과 화면은 평균 음높이와 분당 음절만 보여 주어 원시 수치를 모을 길이 없다.
이 작업은 **녹음 한 번의 분석 결과(원시 특징 + 여섯 축 + 타입 코드)를 사용자가 자기 기기에 JSON 파일로 내려받는 개발용 내보내기**를 더한다. 보정 자체는 녹음이 모인 뒤 별도 작업이다.

## 지키는 원칙

- 음성(Blob·PCM·포락선)은 어떤 형태로도 파일에 넣지 않는다.
- 서버로 보내지 않는다. 내보내기는 `Blob` → `<a download>` 로만 동작한다(기존 `downloadBlob` 재사용).
- localStorage·sessionStorage·쿠키·IndexedDB 등 저장소를 쓰지 않는다. 플래그는 URL 쿼리에서 매번 읽는다.
- 사용자가 버튼을 **명시적으로 누를 때만** 내려받는다. 자동 다운로드 없음.
- 개인 식별 정보·시각·IP·UA·기기 정보를 넣지 않는다.

## 범위

| 영역 | 변경 |
| --- | --- |
| `src/features/export/calibration.ts` | 신설. 순수 함수: 내보내기 레코드 생성, f0 정규화 밝기, 파일 이름, JSON Blob, 쿼리 플래그 판정 |
| `src/features/export/calibration.test.ts` | 신설. 스키마 키 집합, 정규화 값, 음성·개인정보 부재, 파일 이름, 플래그 |
| `src/features/analysis/version.ts` | 신설. `ANALYSIS_VERSION` 상수(특징 추출·축 범위 규칙의 판) |
| `src/screens/ResultScreen.tsx` | `?calibrate=1`일 때만 결과 화면 맨 아래에 "보정용 내보내기" 카드(안내 문구 + 버튼 + 상태 문구) |
| `src/screens/ResultScreen.test.tsx` | 플래그 없으면 카드 없음, 있으면 카드·버튼 있음 |
| `src/i18n/messages/ko.ts`, `en.ts` | `result.calibration.*` 4개 |
| `src/styles/global.css` | `.card--dev`(점선 테두리, 그림자 없음) |
| `branches/018-feature-axis-export/` | 설계·구현(수집·보정 절차 포함)·리뷰 문서 |

분석 코드(`features.ts`, `axes.ts`)의 수치·규칙은 바꾸지 않는다.

## 결정 사항

### (a) 노출 방식 — URL 쿼리 `?calibrate=1`로만 보이는 카드

| 후보 | 장점 | 단점 |
| --- | --- | --- |
| 결과 화면의 눈에 띄지 않는 보조 버튼(항상 노출) | 링크를 따로 알릴 필요 없음 | 모든 사용자에게 개발용 UI가 보임. "저장하지 않아요"라고 말하는 화면에 "수치 저장" 버튼이 함께 있어 혼란. 잘못 눌러 JSON이 내려받아지는 경우 생김 |
| **URL 쿼리 `?calibrate=1`일 때만 노출(채택)** | 일반 사용자는 존재를 모름. 수집자는 참가자에게 링크 하나(`https://vocatype.hs827.workers.dev/?calibrate=1`)만 보내면 됨. 저장소 없이 동작 | 링크를 모르면 쓸 수 없음(개발용이므로 의도한 제약) |

- 앱은 라우터 없이 상태로만 화면을 바꾸므로 `location.search`는 녹음 → 생성 → 결과까지 그대로 남는다. 언어·테마 전환도 URL을 건드리지 않는다.
- 판정은 순수 함수 `isCalibrationEnabled(search)`(`calibrate=1`만 참). `ResultScreen`은 마운트 때 `window.location.search`를 한 번 읽는다(`window`가 없는 정적 렌더에서는 거짓).
- 카드는 결과 화면 **맨 아래, 면책 문구 뒤**에 둔다. 점선 테두리(`.card--dev`)로 본문 카드와 구분하고, 안내 문구가 "개발용 · 음성 없음 · 서버로 보내지 않음"을 먼저 말한다.
- 저장 이미지(`renderCard`)는 영향 없음. 리딩·초상 요청도 영향 없음.

### (b) JSON 스키마 (`schemaVersion: 1`)

```jsonc
{
  "schema": "voice-axis-calibration",   // 파일 종류 식별자(고정 문자열)
  "schemaVersion": 1,                   // 이 JSON 모양의 판
  "analysisVersion": 1,                 // 특징 추출·AXIS_RANGES 규칙의 판(ANALYSIS_VERSION)
  "locale": "ko",                       // 낭독한 글의 언어 = 축 계산(pace 범위)에 쓴 언어
  "scriptId": "ko-seosi",               // 낭독 글 id. 캡처가 없으면 null
  "durationMs": 23456,                  // 녹음 길이. 캡처가 없으면 round(features.durationSec × 1000)
  "quality": "ok",                      // 'ok' | 'low-signal'
  "typeCode": "WFME",
  "seed": 2893421043,                   // 특징 해시(초상 요청에 이미 보내는 값). 같은 녹음이면 같아 중복 제거에 씀
  "axes": { "warmth": 0.8, "density": 0.52, "pace": 0.2, "variation": 0.45, "pitch": 0.4, "brightness": 0.4 },
  "features": {                         // VoiceFeatures 전체에서 envelope만 뺀 것 + envelopeLength
    "durationSec": 12, "sampleRate": 16000, "frameCount": 370, "energeticFrameCount": 300, "voicedFrameCount": 250,
    "speechRatio": 0.8, "f0Median": 142, "f0Variation": 0.2, "f0Low": 110, "f0High": 190,
    "rmsMean": 0.08, "rmsVariation": 0.5, "zcrMean": 0.05, "tiltMedian": 0.15, "syllableRate": 4.2, "pauseCount": 2,
    "envelopeLength": 300
  },
  "derived": {
    "tiltNormalized": 2.69              // tiltMedian / (2π·f0Median / sampleRate). f0Median ≤ 0이면 null
  },
  "axisRanges": { "pitch": [85, 255], "brightness": [0.06, 0.3], "density": [0.6, 0.95], "pace": { "ko": [3.5, 7], "en": [2.5, 5.5] }, "f0Variation": [0.08, 0.3], "rmsVariation": [0.25, 0.75] }
}
```

- **envelope 제외**: 말하는 구간의 프레임별 에너지 시계열이다. 말소리를 복원할 수는 없지만 녹음의 시간 흐름 그 자체이고, 보정(축 범위 조정)에는 필요 없다. 최소 수집 원칙에 따라 길이만 남긴다.
- **features는 `envelope`를 뺀 나머지를 통째로** 담는다(구현은 구조 분해). `VoiceFeatures`에 필드가 늘면 자동으로 들어가지만, 테스트가 키 집합을 고정하므로 그때 `schemaVersion`을 올리도록 강제된다. → 1차 리뷰로 구조 분해 대신 **허용 목록**(필드를 하나씩 옮김)으로 바뀌어 새 필드는 컴파일 단계에서 걸린다. 02 "설계 대비 달라진 점" 참고.
- **`axisRanges` 스냅샷**: 각 파일이 "어느 범위로 이 축 값이 나왔는지"를 스스로 설명한다. 보정 스크립트는 `features`에서 새 범위로 축을 다시 계산하면 되므로 분석 코드가 바뀌어도 모인 파일이 쓸모를 잃지 않는다.
- **`derived.tiltNormalized`**: 004 문서가 검토하라고 적은 f0 정규화 밝기 후보. `spectralTilt`는 순음에서 `2π·f/fs`에 비례하므로(dsp.ts 주석) 이 값은 순음 ≈ 1, 배음이 많을수록 커지는 "배음 풍부도"가 된다. 지금 축 계산에는 쓰지 않고 후보 수치만 같이 모은다.
- **앱 버전은 넣지 않는다**: 배포는 Git 푸시마다 이루어져 `package.json`의 버전이 올라가지 않는다. 보정에 필요한 식별자는 "어떤 분석 규칙으로 나온 수치인가"이므로 `ANALYSIS_VERSION` 하나를 두고, 특징 계산이나 `AXIS_RANGES`가 바뀔 때 올린다.
- **넣지 않는 것**: 시각(날짜·타임스탬프), 사용자 에이전트, IP, 기기·브라우저 정보, 언어 외의 설정, 음성·포락선, 리딩 텍스트·초상.

### (c) 파일 이름

`<서비스 이름 소문자>-calib-<locale>-<typeCode>-<seed>.json` — 예: `vocatype-calib-ko-WFME-2893421043.json`

- 과제의 예시(`vocatype-calib-<typeCode>-<seed>.json`)에 **locale**을 더했다. brightness·pace 보정이 언어별이라 파일 이름만으로 나눌 수 있어야 한다.
- `seed`는 특징 해시라 같은 사람이 두 번 녹음해도 다르다(재현성 비교에 두 파일 모두 남음). 이름에 시각이나 이름을 넣지 않는다.
- 접두사는 `SERVICE_NAME.toLowerCase()`로 PNG 저장과 같은 규칙.

## 구조

```
ResultScreen ── isCalibrationEnabled(location.search) ── 카드 표시 여부
     │  클릭
     ▼
buildCalibrationExport(profile, capture, uiLocale) ─▶ CalibrationExport(순수 객체)
     ├─ normalizedTilt(features)                       derived.tiltNormalized
     ├─ calibrationFilename(record, SERVICE_NAME)      파일 이름
     └─ calibrationBlob(record)                        JSON Blob(application/json, 2칸 들여쓰기)
                       │
                       ▼
             downloadBlob(blob, filename)  (export/save.ts, 기존)
```

`buildCalibrationExport`는 `capture.recording.blob`을 읽지 않는다(테스트에서 `blob` 접근 시 예외를 던지는 캡처로 확인).

## 메시지

| 키 | ko | en |
| --- | --- | --- |
| `result.calibration.title` | 보정용 내보내기 (개발용) | Calibration export (developer) |
| `result.calibration.note` | 음성 없이 분석 수치(원시 특징·여섯 축·타입)만 JSON 파일로 이 기기에 저장해요. 서버로 보내지 않아요. | Saves only the analysis numbers (raw features, six axes, type) as a JSON file on this device. No audio, and nothing is sent to a server. |
| `result.calibration.export` | JSON 내려받기 | Download JSON |
| `result.calibration.saved` | 저장했어요: {filename} | Saved: {filename} |

## 검증 계획

1. 단위 테스트(`calibration.test.ts`): 최상위 키 집합과 `features` 키 집합 고정, `tiltNormalized` 수치(픽스처)와 순음 성질(≈1), f0 0이면 null, JSON 문자열에 `envelope`·`blob`·시각·UA 키 없음, 캡처의 `blob` 접근 없음, 파일 이름 규칙, 플래그 판정, 결정성.
2. `ResultScreen.test.tsx`: 플래그 없는 정적 렌더에 카드 없음(기존 테스트 환경은 `window`가 없어 플래그 거짓). 플래그가 있을 때의 카드는 브라우저에서 확인.
3. `npm run typecheck && npm run lint && npm test && npm run build`, 종료 코드 확인.
4. 브라우저(`.claude/launch.json`의 `dev`, 5173): `getUserMedia`를 합성 말소리 스트림으로 바꿔 녹음 → 생성 → 결과. `?calibrate=1`이면 카드가 맨 아래 보이고, 버튼을 누르면 JSON 한 파일이 내려받아지며 내용이 스키마대로인지, 클릭 전후 네트워크 요청이 없는지, `localStorage`·쿠키가 비어 있는지 확인. 플래그 없이 같은 흐름에서 카드가 없는지 확인.
