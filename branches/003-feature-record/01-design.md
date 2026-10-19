# 003 feature/record — 설계 문서

## 목표

녹음 화면을 완성한다. 사용자는 퍼블릭 도메인 작품 한 편을 보고 소리 내어 읽으며 녹음하고, 들어 본 뒤 "생성하기"로 넘어간다.
녹음은 브라우저 안에만 머문다. 서버로 보내거나 저장하지 않는다.

## 범위

### 포함

- `src/features/scripts/scripts.ts`: 한국어 6편, 영어 6편 스크립트 데이터와 `pickScript`, `estimateReadingSeconds`
- `src/features/recorder/`: `useRecorder` 훅(권한 요청, MediaRecorder, 입력 레벨 미터, 최대 길이 자동 종료, 자원 해제), 순수 헬퍼(`pickMimeType`, `mapRecorderError`, `formatDuration`), `Recording`/`Capture` 타입
- `src/screens/RecordScreen.tsx`: 스크립트 카드, 다른 글 보기, 녹음 버튼(레벨에 반응하는 링), 타이머, 미리 듣기, 다시 녹음, 생성하기, 오류 안내
- `src/App.tsx`: `Capture { script, recording }` 상태를 들고 생성 화면에 전달
- `shared/config.ts`: `RECORDING_MAX_SECONDS = 30`, `RECORDING_MIN_SECONDS = 3`
- 메시지 키 추가, 스타일, 단위 테스트(스크립트 데이터, mime 선택, 오류 매핑, 시간 표기)

### 제외

- 음성 분석(004), 결과(005)
- 녹음 파일 다운로드 (개인정보 원칙상 결과 카드 이미지만 저장)

## 스크립트 선정 기준

| 언어 | 기준 | 수록 |
| --- | --- | --- |
| 한국어 | 저자가 1962년 12월 31일 이전에 사망해, 사후 50년 보호가 2013년 7월 1일(70년 개정 시행) 전에 끝난 작품 | 윤동주 서시·별 헤는 밤(발췌), 김소월 진달래꽃, 이육사 청포도(발췌), 한용운 님의 침묵(발췌), 정지용 향수(발췌) |
| 영어 | 1929년 이전 출판 또는 저자 사후 70년 경과 | Shakespeare Sonnet 18·All the world's a stage, Dickinson "Hope", Henley Invictus, Wordsworth Daffodils, Lincoln Gettysburg Address |

낭독 20~30초 분량으로 발췌했고, 카드에 "발췌" 표시와 "저작권이 만료된 작품" 안내를 둔다.

## 화면 구성

```
[진행: ● 녹음  ○ 생성  ○ 결과]
스크립트를 읽어 주세요
평소 말하듯 자연스럽게 읽어 주세요. 10~30초면 충분해요.

┌ 서시 ─ 윤동주 · 1941 ─────── [발췌] ┐
│ 죽는 날까지 하늘을 우러러             │
│ …                                    │
│ 저작권이 만료된 작품        [다른 글] │
└──────────────────────────────────────┘

           ( ● )   ← 88px 원형 버튼, 녹음 중엔 ■ + 레벨 링
          0:07 / 0:30
     읽는 중… 다 읽으면 버튼을 다시 눌러요

(끝난 뒤)  [▶ 미리 듣기 ──────]
           [다시 녹음]  [생성하기]
[뒤로]
```

## 녹음 훅 상태

```
idle ──start()──▶ requesting ──권한 OK──▶ recording ──stop()/최대 길이──▶ done
                     │                        │
                     └─거부/장치 없음──▶ error ◀┘ (MediaRecorder 오류)
reset(): 어느 상태에서든 idle로. 언마운트 시에도 같은 정리.
```

- `getUserMedia({ audio: { echoCancellation, noiseSuppression, autoGainControl } })`
- mime: `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4;codecs=mp4a.40.2` → `audio/mp4` → `audio/ogg;codecs=opus` 순으로 `isTypeSupported` 확인. Safari는 mp4.
- 레벨 미터: `AudioContext` + `AnalyserNode`로 RMS 계산. 50ms 간격으로만 상태 갱신해 렌더 수를 제한.
- 최대 길이는 `setTimeout`이 책임지고(탭이 숨겨져도 동작), `requestAnimationFrame` 루프는 타이머·레벨 표시만 맡는다.
- 종료 시 트랙 정지, `AudioContext.close()`. 미리 듣기용 object URL은 훅이 만들고 reset·언마운트 때 `revokeObjectURL`.
- 권한 프롬프트 중에 화면을 떠나면 세대 토큰으로 뒤늦게 열린 스트림을 즉시 닫는다.

## 인터페이스

```ts
interface Recording { blob: Blob; mimeType: string; durationMs: number }
interface Capture { script: Script; recording: Recording }

useRecorder({ maxMs }): {
  status: 'idle' | 'requesting' | 'recording' | 'done' | 'error'
  error: 'permission-denied' | 'no-microphone' | 'busy' | 'unsupported' | 'unknown' | null
  elapsedMs: number; level: number /* 0..1 */; recording: Recording | null
  start(): Promise<void>; stop(): void; reset(): void
}

<RecordScreen onNavigate onCaptured(capture) />
```

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| MediaRecorder + 원본 Blob 보관 | 004가 `decodeAudioData`로 PCM을 얻어 분석한다. 압축 포맷이라 메모리도 작다. |
| 최소 3초, 최대 30초 | 3초 미만은 피치·속도 추정이 불안정하고, 30초면 스크립트 낭독에 충분하다. |
| 레벨 링을 CSS transform으로 | 캔버스 파형보다 가볍고 모바일에서 부드럽다. 파형 아트는 005의 사운드 시그니처가 맡는다. |
| 언어 전환 시 스크립트도 교체(녹음 중 제외) | 읽을 글은 UI 언어와 같아야 자연스럽다. 녹음 중에는 글이 바뀌면 낭독이 끊기므로 유지. |
| 오류를 다섯 종류로만 매핑 | 사용자가 할 수 있는 조치(권한 허용, 마이크 연결, 다른 앱 종료, 브라우저 변경)에 맞춘 분류. |

## 검증 계획

1. typecheck / lint / test / build 통과
2. 브라우저: 스크립트 표시와 교체, 언어 전환 시 스크립트 교체, 권한 거부 시 오류 안내와 재시도, 녹음·정지·타이머·레벨 링, 최대 길이 자동 종료, 미리 듣기, 3초 미만 안내, 생성하기로 전이
3. 녹음 중 뒤로 가기 시 마이크 표시등이 꺼지는지(트랙 해제) 확인
