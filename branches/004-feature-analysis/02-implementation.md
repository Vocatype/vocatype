# 004 feature/analysis — 구현 문서

## 요약

녹음을 브라우저 안에서 분석해 `VoiceProfile`(타입 코드, 6축, 원시 특징, 씨앗, 신호 품질)을 만든다.
16kHz로 다운샘플한 PCM에서 프레임별 RMS·영교차율·YIN 피치를 구하고, 이를 6축(0..1)으로 사상한 뒤 임계 0.5로 4글자 타입 코드를 만든다.
타입 코드·카탈로그·프롬프트 생성기는 `shared/`에 두어 006의 Worker가 그대로 쓴다. 생성 화면은 분석 진행률을 보여 주고 끝나면 결과 화면으로 넘어간다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `shared/typeCode.ts` | `TypeCode`, `ALL_TYPE_CODES`, `AXIS_LETTERS`, `isTypeCode` |
| `shared/catalog.ts` | 4축 설명, 16타입 이름·설명(ko/en), 퍼스널 컬러 4계절, 향 노트, 궁합, `buildPortraitPrompt` |
| `shared/catalog.test.ts` | 카탈로그 무결성(16개, 이름 유일, 계절 규칙, 향 노트, 궁합 대칭, 프롬프트 금지어) |
| `src/features/analysis/dsp.ts` | 다운믹스, 다운샘플, RMS, 영교차율, YIN, 통계 |
| `src/features/analysis/dsp.test.ts` | 정현파·배음·잡음 피치, 리샘플, RMS/ZCR, 통계 |
| `src/features/analysis/features.ts` | `VoiceFeatures`, `extractFeatures` (프레임 루프, 유성 판정, 음절 속도, 쉼, 포락선) |
| `src/features/analysis/features.test.ts` | 무음, 합성 음절 톤, 앞뒤 무음, 진행률 |
| `src/features/analysis/axes.ts` | `VoiceAxes`, `featuresToAxes`, `axesToTypeCode`, `seedFromFeatures`, `isLowSignal` |
| `src/features/analysis/axes.test.ts` | 사상 함수, 축→글자, 신호 부족, 씨앗 |
| `src/features/analysis/decode.ts` | `decodeRecording` (`AudioContext.decodeAudioData`) |
| `src/features/analysis/analyze.ts` | `analyzeRecording` 오케스트레이션, 진행률 콜백 |
| `src/features/profile/types.ts` | `VoiceProfile`, 재export |
| `src/screens/GeneratingScreen.tsx` | 분석 실행, 진행률 막대, 단계 문구, 취소, 실패 시 재시도/다시 녹음 |
| `src/screens/ResultScreen.tsx` | 자리표시: 타입 코드·이름·설명·축 값 확인용 (005에서 카드로 교체) |
| `src/App.tsx` | `profile` 상태, `onAnalyzed` → 결과 전이 |
| `src/i18n/messages/{ko,en}.ts` | 생성 단계·오류·결과 확인 문구 |
| `src/styles/global.css` | 생성 화면 진행 막대 |

## 주요 구현

- **프레임 처리**: 16kHz, 창 1024(64ms), 간격 512(32ms). 에너지 상위 10% RMS의 12%(최소 0.004)를 무성 임계로 써서 마이크 게인 차이를 흡수한다. 에너지가 있는 프레임만 YIN(60~500Hz, 임계 0.15)을 돌리고 신뢰도 0.6 이상이면 유성으로 본다.
- **양보**: 48프레임마다 `setTimeout(0)`으로 이벤트 루프에 양보하고 진행률(0~0.3 프레임, 0.3~0.95 피치, 1 완료)을 콜백으로 알린다. 30초 녹음 기준 수백 ms.
- **음절 속도**: 말하는 구간(첫~끝 유성 프레임)의 RMS를 3탭 평활한 뒤, 95퍼센타일의 30%를 넘는 국소 최대를 최소 3프레임(96ms) 간격으로 센다. 초당 음절 = 봉우리 수 / 유성 시간.
- **축 사상**: `pitch` 85~255Hz 로그, `brightness` ZCR 0.03~0.12, `density` 말 밀도 0.5~0.95, `pace` 2.5~6/초, `variation` 피치 IQR/중앙값(0.08~0.30) 60% + 에너지 변동(0.25~0.75) 40%, `warmth = 1 − (0.6·pitch + 0.4·brightness)`. 유성 프레임 20개 미만이거나 피치가 없으면 모든 축 0.5, `quality: 'low-signal'`.
- **씨앗**: 특징 8개를 반올림해 FNV-1a 32비트 해시. 같은 녹음이면 같은 씨앗.
- **카탈로그를 `shared/`에**: 타입 코드·이름·설명·컬러·향·궁합·프롬프트는 React에 의존하지 않는 데이터라 Worker(006)가 프롬프트 생성과 요청 검증에 그대로 쓴다. `shared/` 안의 상대 import는 `tsconfig.node/worker`의 `nodenext` 규칙 때문에 `.ts` 확장자를 붙인다.
- **생성 화면**: `analyzeRecording` → 최소 1.4초 표시 → `onAnalyzed`. 취소·언마운트 시 `cancelled` 플래그로 뒤늦은 콜백을 막고, 부모 콜백은 ref로 받아 effect가 콜백 변경 때문에 다시 돌지 않게 한다. 실패하면 재시도·다시 녹음 버튼.
- **포락선**: 말하는 구간의 프레임 RMS를 최대값으로 정규화한 `envelope`를 특징에 넣는다. 005의 사운드 시그니처가 이 값을 쓴다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| `src/features/profile/catalog.ts` | `shared/typeCode.ts`, `shared/catalog.ts` | 006의 Worker가 프롬프트 생성·타입 코드 검증에 같은 코드를 쓴다. |
| `AudioContext.decodeAudioData` | `OfflineAudioContext.decodeAudioData` | 자동재생 정책과 무관하고 `close()`가 필요 없다. |
| 언급 없음 | `VoiceFeatures.envelope` 추가 | 005 사운드 시그니처가 오디오를 다시 디코딩하지 않게. |
| `GeneratingScreen`이 `capture`를 필수로 받음 | `Capture \| null` 허용, 없으면 안내와 다시 녹음 버튼 | 새로고침 등으로 상태가 비었을 때 빈 화면을 피한다. |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 |
| 린트 | `npm run lint` | 경고 0, 오류 0 (ref 렌더 중 접근 경고는 effect 갱신으로 해소) |
| 단위 테스트 | `npm test` | 11 파일 59 테스트 통과 (정현파 110/180/240Hz 2% 이내, 배음 신호 기본음, 4Hz 음절 톤 속도 3~5/초, 무음 NaN 없음, 카탈로그 16개·궁합 대칭·프롬프트 금지어) |
| 빌드 | `npm run build` | 통과 |
| 전체 흐름 (150Hz·4Hz 변조 합성 스트림 6초) | 브라우저 | 생성 화면 진행 막대 100%, "타입을 정하는 중" → 결과 `WFME · 깊은 숲의 안내자`, 축 warmth 0.69 · density 1.00 · pace 0.45 · variation 0.18 · pitch 0.52 · brightness 0.00. 150Hz는 85~255Hz 로그 중간(≈147Hz)이라 pitch 0.52, 순음이라 brightness 0, 쉼 없는 변조라 density 1, 4음절/초라 pace 0.45로 설계대로 |
| 신호 부족 (무음 스트림 4초) | 브라우저 | 아래 리뷰 문서의 구현자 확인 참조 |
| 취소 | 브라우저 | 아래 리뷰 문서의 구현자 확인 참조 |
