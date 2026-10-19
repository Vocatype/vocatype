# 004 feature/analysis — 구현 문서

## 요약

녹음을 브라우저 안에서 분석해 `VoiceProfile`(타입 코드, 6축, 원시 특징, 씨앗, 신호 품질)을 만든다.
16kHz PCM에서 프레임별 RMS·스펙트럼 기울기·YIN 피치를 구하고, 이를 6축(0..1)으로 사상한 뒤 임계 0.5로 4글자 타입 코드를 만든다.
1차 리뷰 반영(커밋 `6165f8f`)까지 포함한 최종 상태를 기록한다.
타입 코드·카탈로그·프롬프트 생성기는 `shared/`에 두어 006의 Worker가 그대로 쓴다. 생성 화면은 분석 진행률을 보여 주고 끝나면 결과 화면으로 넘어간다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `shared/typeCode.ts` | `TypeCode`, `ALL_TYPE_CODES`, `AXIS_LETTERS`, `isTypeCode` |
| `shared/catalog.ts` | 4축 설명, 16타입 이름·설명(ko/en), 퍼스널 컬러 4계절, 향 노트, 궁합, `buildPortraitPrompt` |
| `shared/catalog.test.ts` | 카탈로그 무결성(16개, 이름 유일, 계절 규칙, 향 노트, 궁합 대칭, 프롬프트 금지어) |
| `src/features/analysis/dsp.ts` | 다운믹스, 다운샘플(폴백), 하이패스, RMS, 영교차율, 스펙트럼 기울기, YIN(옥타브 검사), 통계 |
| `src/features/analysis/dsp.test.ts` | 정현파·배음·잡음·약한 기본음 피치, 비정수 리샘플, 하이패스, RMS/ZCR/기울기, 통계 |
| `src/features/analysis/features.ts` | `VoiceFeatures`, `extractFeatures` (프레임 루프, 에너지·유성 판정, 조음 속도, 쉼, 포락선, 취소 신호) |
| `src/features/analysis/features.test.ts` | 무음, 합성 음절 톤, 앞뒤 무음, 말소리형 신호(자음·쉼) 4종, 진행률·취소 |
| `src/features/analysis/axes.ts` | `VoiceAxes`, `AXIS_RANGES`, `featuresToAxes(features, { locale })`, `axesToTypeCode`, `seedFromFeatures`, `isLowSignal` |
| `src/features/analysis/axes.test.ts` | 사상 함수, 축→글자, 신호 부족, 씨앗 |
| `src/features/analysis/decode.ts` | `decodeRecording` (16kHz `OfflineAudioContext`, 44.1kHz 폴백) |
| `src/features/analysis/analyze.ts` | `analyzeRecording(recording, { locale, signal, onProgress })` |
| `src/features/profile/types.ts` | `VoiceProfile`, 재export |
| `src/screens/GeneratingScreen.tsx` | 분석 실행, 진행률 막대(`aria-valuetext`), 단계 문구, `AbortController` 취소, 실패 시 재시도/다시 녹음 |
| `src/screens/ResultScreen.tsx` | 자리표시: 타입 코드·이름·설명·축 값 확인용 (005에서 카드로 교체) |
| `src/App.tsx` | `profile` 상태, `onAnalyzed` → 결과 전이 |
| `src/i18n/messages/{ko,en}.ts` | 생성 단계·오류·결과 확인 문구 |
| `src/styles/global.css` | 생성 화면 진행 막대 |

## 주요 구현

- **전처리**: 디코딩을 16kHz `OfflineAudioContext`로 해 브라우저 리샘플러가 바로 16kHz를 만든다(거부하면 44.1kHz로 디코딩 후 상자 필터 리샘플). 그 뒤 1차 하이패스(α 0.98, 차단 약 50Hz)로 DC 오프셋과 럼블을 제거해 RMS·기울기가 기기별로 흔들리지 않게 한다.
- **프레임 처리**: 창 1024(64ms), 간격 512(32ms). 에너지 상위 10% RMS의 12%(최소 0.004)를 무음 임계로 써서 마이크 게인 차이를 흡수한다. 에너지가 있는 프레임만 YIN(60~500Hz, 임계 0.15)을 돌리고 신뢰도 0.6 이상이면 유성으로 본다.
- **YIN 옥타브 검사**: 임계 아래 첫 dip의 국소 최소를 고른 뒤, 그 값이 0.03보다 크면 2τ±2 근처에 절반 이하로 더 깊은 최소가 있는지 보고 있으면 그쪽을 택한다. 기본음이 약하고 짝수 배음이 강한 신호(폰 마이크의 저역 감쇠)에서 2배 피치가 나오는 오류를 막는다. 순음은 dip이 거의 0이라 검사를 건너뛴다. dip을 찾으면 2τ+2까지만 계산해 연산을 줄인다.
- **밀도·속도**: 말하는 구간(첫~끝 유성 프레임) 중 **에너지가 있는 프레임** 비율을 밀도로 쓴다(자음·숨도 말소리로 센다). 조음 속도는 3탭 평활 RMS의 봉우리(95퍼센타일의 30% 이상, 돌출도 12% 이상, 최소 4프레임 간격)를 **에너지가 있는 시간**으로 나눈 값이라 쉼이 속도를 부풀리지 않는다.
- **양보와 취소**: 48프레임마다 `scheduler.yield()`(없으면 MessageChannel 매크로태스크)로 양보하고 `AbortSignal`을 확인해 취소되면 즉시 던진다. 진행률은 0~0.3 프레임, 0.3~0.95 피치, 1 완료.
- **축 사상** (`AXIS_RANGES`): `pitch` 85~255Hz 로그, `brightness` 스펙트럼 기울기(차분 RMS / RMS) 0.06~0.30, `density` 0.6~0.95, `pace` 한국어 3.5~7 / 영어 2.5~5.5 음절/초(낭독 언어를 `capture.script.locale`로 받음), `variation` 피치 IQR/중앙값(0.08~0.30) 60% + 에너지 변동(0.25~0.75) 40%, `warmth = 1 − (0.4·pitch + 0.6·brightness)`. 음높이만으로 온도를 정하면 성별 분류기가 되므로 음색 밝기에 더 큰 비중을 둔다. 유성 프레임 20개 미만이거나 피치가 없으면 모든 축 0.5, `quality: 'low-signal'`.
- **씨앗**: 특징 8개를 반올림해 FNV-1a 32비트 해시. 같은 녹음이면 같은 씨앗.
- **카탈로그를 `shared/`에**: 타입 코드·이름·설명·컬러·향·궁합·프롬프트는 React에 의존하지 않는 데이터라 Worker(006)가 프롬프트 생성과 요청 검증에 그대로 쓴다. `shared/` 안의 상대 import는 `tsconfig.node/worker`의 `nodenext` 규칙 때문에 `.ts` 확장자를 붙인다. 향 노트 목록은 무거운 순이고, 프롬프트는 hex 대신 색 이름(`promptColors`)을 쓴다.
- **생성 화면**: `analyzeRecording` → 최소 1.4초 표시 → `onAnalyzed`. 취소·언마운트 시 `AbortController.abort()`로 분석 루프를 멈추고 뒤늦은 콜백을 막는다. 부모 콜백은 ref로 받아(effect에서 갱신) effect가 콜백 변경 때문에 다시 돌지 않게 한다. 실패하면 재시도·다시 녹음 버튼.
- **포락선**: 말하는 구간의 프레임 RMS를 최대값으로 정규화한 `envelope`를 특징에 넣는다. 005의 사운드 시그니처가 이 값을 쓴다.

## 알려진 한계와 보정

축 범위(`AXIS_RANGES`)는 합성 신호로만 검증한 초기값이다. 실제 화자 10명 이상의 녹음으로 각 축의 분포를 보고, 중앙값이 0.5 근처에 오도록 범위를 조정해야 16개 타입이 고르게 나온다. 특히 `brightness`(기울기)와 `pace`의 언어별 범위가 그렇다. 이 보정은 마이크가 있는 환경에서 별도 작업으로 진행한다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| `src/features/profile/catalog.ts` | `shared/typeCode.ts`, `shared/catalog.ts` | 006의 Worker가 프롬프트 생성·타입 코드 검증에 같은 코드를 쓴다. |
| `AudioContext.decodeAudioData`, PCM 44.1k/48k를 상자 필터로 16k 다운샘플 | 16kHz `OfflineAudioContext`로 디코딩 | 브라우저 리샘플러가 더 정확하고(상자 필터는 치찰음이 접힘), 자동재생 정책과 무관하며 `close()`가 필요 없다. |
| 밝기 = 영교차율 | 밝기 = 스펙트럼 기울기(차분 RMS / RMS) | 리뷰 M1. 진폭 가중이라 작은 잡음에 덜 흔들리고 성별 상관이 덜하다. 영교차율은 참고용으로 남긴다. |
| 밀도 = 유성 프레임 비율, 속도 = 봉우리/유성 시간 | 밀도 = 에너지 프레임 비율, 속도 = 봉우리/에너지 시간, 언어별 범위 | 리뷰 C1. 자음·숨을 빼면 실제 화자가 거의 전부 L·Q로 쏠린다. |
| 취소는 콜백만 막음 | `AbortSignal`로 루프 중단 | 리뷰 M3. 취소 직후 녹음 화면과 메인 스레드를 다투지 않게. |
| 언급 없음 | `VoiceFeatures.envelope` 추가 | 005 사운드 시그니처가 오디오를 다시 디코딩하지 않게. |
| `GeneratingScreen`이 `capture`를 필수로 받음 | `Capture \| null` 허용, 없으면 안내와 다시 녹음 버튼 | 새로고침 등으로 상태가 비었을 때 빈 화면을 피한다. |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 |
| 린트 | `npm run lint` | 경고 0, 오류 0 |
| 단위 테스트 | `npm test` | 11 파일 69 테스트 통과 (정현파 110/180/240Hz 2% 이내, 배음 신호·약한 기본음 신호 기본음, 순음 옥타브 유지, 44.1k 리샘플, 하이패스, 말소리형 신호 110/210Hz × 4.5/6음절/초에서 피치 3%·조음 속도 15%·밀도 0.08 이내·쉼 3회, 취소 거부, 카탈로그 16개·궁합 대칭·프롬프트 금지어 정규식) |
| 빌드 | `npm run build` | 통과 |
| 전체 흐름 (말소리형 합성 스트림: 자음 잡음 + 배음 모음, 8음절마다 0.4초 쉼, 8초) | 브라우저 | 120Hz·4.5음절/초(한국어 글) → `WFME · 깊은 숲의 안내자`, warmth 0.69 · density 0.65 · pace 0.28 · variation 0.06 · pitch 0.31 · brightness 0.30. 220Hz·6음절/초 → `CFQE · 유리알 해설자`, warmth 0.27 · density 0.54 · pace 0.72 · pitch 0.87 · brightness 0.65. 피치·속도·밀도가 입력대로 갈리고 진행 막대·단계 문구 정상 |
| 신호 부족 (무음 스트림 4초) | 브라우저 | 모든 축 0.50, 타입 `WFQV`(임계 0.5 포함 규칙). 005에서 `quality: 'low-signal'` 안내 문구를 붙인다 |
| 취소 | 브라우저 | 생성 직후 "취소" → 녹음 화면 유지, 진행 표시 "녹음". 뒤늦게 끝난 분석이 결과로 건너뛰지 않음(`cancelled` 플래그 + 리듀서 전이 검사) |
