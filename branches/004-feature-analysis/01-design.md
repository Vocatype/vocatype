# 004 feature/analysis — 설계 문서

## 목표

녹음을 브라우저 안에서 분석해 "보이스 프로필"을 만든다. 프로필은 결과 화면(005)과 AI 어댑터(006)가 공통으로 쓰는 유일한 입력이다.
AI 없이도 전체 흐름이 실제 측정값으로 동작하는 것이 이 작업의 핵심이다.

## 범위

### 포함

- `src/features/analysis/`
  - `dsp.ts`: 모노 다운믹스, 다운샘플링, RMS, 영교차율, YIN 피치 추정, 통계 헬퍼
  - `features.ts`: 프레임 단위 특징 → `VoiceFeatures`(피치 중앙값·변화, 에너지·변화, 밝기, 음절 속도, 말 밀도, 쉼 횟수)
  - `axes.ts`: `VoiceFeatures` → 6축(0..1) → 4글자 타입 코드, 결정적 씨앗
  - `decode.ts`: Blob → PCM (`AudioContext.decodeAudioData`)
  - `analyze.ts`: 디코딩 → 특징 → 프로필 오케스트레이션, 진행률 콜백
- `src/features/profile/`
  - `types.ts`: `VoiceProfile`, `Localized`
  - `catalog.ts`: 4축 설명, 16개 타입 이름·설명(ko/en), 퍼스널 컬러 4계절, 시그니처 향 노트, 궁합, 초상화 프롬프트
- `src/screens/GeneratingScreen.tsx`: 분석 실행, 단계·진행률 표시, 취소, 실패 처리
- `src/App.tsx`: `profile` 상태, 분석 완료 시 결과 화면으로 전이
- `src/screens/ResultScreen.tsx`: 자리표시를 "타입 코드·이름·축 값" 확인용으로 교체 (005에서 카드로 완성)
- 단위 테스트: DSP(정현파·배음·잡음), 특징 추출(합성 음절 톤·무음·앞뒤 무음), 축 사상, 카탈로그 무결성

### 제외

- 결과 카드 UI, 사운드 시그니처 그림, 이미지 저장 (005)
- 서버·AI 호출 (006). 이 작업은 네트워크를 쓰지 않는다

## 분석 파이프라인

```
Blob ─decodeAudioData─▶ PCM(44.1k/48k) ─다운믹스·16kHz 다운샘플─▶ samples
  ─프레임(64ms, 32ms 간격)─▶ rms, zcr ─에너지 상위 10% 대비 상대 임계─▶ 에너지 프레임
  ─YIN(60~500Hz, 신뢰도 ≥ 0.6)─▶ 유성 프레임 + f0
  ─집계─▶ VoiceFeatures ─사상─▶ VoiceAxes ─임계 0.5─▶ TypeCode
```

| 특징 | 계산 | 축 사상 |
| --- | --- | --- |
| `f0Median` | 유성 프레임 피치 중앙값 | `pitch`: 85~255Hz 로그 눈금 |
| `zcrMean` | 유성 프레임 영교차율 평균 | `brightness`: 0.03~0.12 |
| `speechRatio` | 첫~끝 유성 프레임 구간 중 유성 비율 | `density`: 0.5~0.95 |
| `syllableRate` | 매끄럽게 한 에너지 봉우리 수 / 유성 시간 | `pace`: 2.5~6 /초 |
| `f0Variation`, `rmsVariation` | IQR/중앙값, 표준편차/평균 | `variation`: 0.6·(0.08~0.30) + 0.4·(0.25~0.75) |
| — | `1 − (0.6·pitch + 0.4·brightness)` | `warmth` |

4축 글자: 온도 `W/C`(warmth), 밀도 `F/L`(density), 속도 `Q/M`(pace), 흐름 `V/E`(variation). 예: `WFQV`.

마이크 게인은 기기마다 달라 절대 에너지는 쓰지 않는다. 밀도는 "쉬지 않고 말하는 비율", 강약은 "평균 대비 변동"처럼 상대값만 쓴다.

## 프로필 → 결과 요소

| 요소 | 규칙 |
| --- | --- |
| 타입 이름·설명 | 16개 코드마다 고정 (카탈로그) |
| 퍼스널 컬러 | 온도×밀도: W+F 가을 웜, W+L 봄 웜, C+F 겨울 쿨, C+L 여름 쿨. 팔레트 5색 |
| 시그니처 향 | 탑=속도(시트러스/티), 미들=흐름(플로럴/허브), 베이스=온도(앰버/머스크). 밀도가 무거운·가벼운 노트를 고름 |
| 궁합 | 최고: 밀도·속도 반전(온도·흐름 유지). 반대: 네 축 반전 |
| 초상화 프롬프트 | 온도→조명, 밀도→자세, 속도·흐름→표정, 퍼스널 컬러→의상. 성별·나이·인종은 지정하지 않음 |
| 씨앗 | 특징을 반올림해 FNV-1a 해시. 같은 녹음이면 같은 결과 |

## 인터페이스

```ts
interface VoiceProfile { typeCode; axes; features; seed; quality: 'ok' | 'low-signal' }
analyzeRecording(recording, onProgress?: ({ stage, progress }) => void): Promise<VoiceProfile>
getVoiceType(code) / getPersonalColor(code) / getScent(code) / getCompatibility(code) / buildPortraitPrompt(code)
<GeneratingScreen capture onNavigate onAnalyzed(profile) />
```

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| Web Worker 대신 메인 스레드 + 주기적 양보 | 30초 녹음 기준 수백 ms로 끝난다. 48프레임마다 `setTimeout(0)`으로 양보해 진행 표시가 멈추지 않는다. 워커는 번들·테스트 복잡도만 늘린다. |
| YIN | 자기상관보다 옥타브 오류가 적고 구현이 작다. 포물선 보간으로 정수 지연 오차를 줄인다. |
| 16kHz 다운샘플 | 피치 상한 500Hz에 충분하고 연산량이 1/3이다. |
| 유성 판정에 피치 신뢰도 사용 | 숨소리·잡음 프레임을 빼야 피치 중앙값과 음절 속도가 안정된다. |
| 신호가 거의 없으면 축을 0.5로 | 결과가 비어 보이지 않게 하되 `quality: 'low-signal'`로 표시해 005가 안내 문구를 보여 준다. |
| 콘텐츠 문구는 카탈로그에, UI 문구는 메시지 사전에 | 타입 설명은 데이터이고 로케일별로 함께 관리하는 편이 읽기 쉽다. |

## 검증 계획

1. typecheck / lint / test / build 통과
2. 합성 신호 테스트: 110/180/240Hz 정현파 피치 2% 이내, 배음 신호에서 기본음, 4Hz 음절 변조에서 속도 3~5/초, 무음에서 NaN 없음
3. 브라우저: 실제 녹음 → 생성 화면 진행률 → 결과 자리표시에 타입 코드 표시. 취소 시 녹음 화면 복귀
