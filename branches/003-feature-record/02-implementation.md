# 003 feature/record — 구현 문서

## 요약

녹음 화면을 완성했다. 퍼블릭 도메인 스크립트 12편(ko 6, en 6) 중 하나를 보여 주고, `useRecorder` 훅이 마이크 권한·`MediaRecorder`·레벨 미터·자동 종료·자원 해제를 맡는다.
녹음은 메모리의 Blob으로만 존재하고 네트워크를 쓰지 않는다. `App`이 `Capture { script, recording }`를 들고 생성 화면에 넘긴다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `shared/config.ts` | `RECORDING_MIN_SECONDS = 3`, `RECORDING_MAX_SECONDS = 30` |
| `src/features/scripts/scripts.ts` | `Script` 타입, 12편 데이터, `scriptsFor`, `pickScript`, `estimateReadingSeconds` |
| `src/features/scripts/scripts.test.ts` | id 유일성, 편수, 빈 내용, 낭독 시간 10~40초, 선택 규칙 |
| `src/features/recorder/types.ts` | `Recording`, `Capture` |
| `src/features/recorder/recorderSupport.ts` | `pickMimeType`, `mapRecorderError`, `isRecordingSupported`, `formatDuration`, `levelFromSamples` |
| `src/features/recorder/recorderSupport.test.ts` | 위 순수 함수 테스트 |
| `src/features/recorder/useRecorder.ts` | 녹음 훅 (상태 머신 idle → requesting → recording → done / error) |
| `src/screens/RecordScreen.tsx` | 스크립트 카드, 다른 글, 녹음 버튼·레벨 링·타이머·힌트, 미리 듣기, 다시 녹음, 생성하기, 오류 안내, 뒤로 |
| `src/screens/GeneratingScreen.tsx` | 자리표시 유지. `capture`를 받아 스크립트 제목을 표시 |
| `src/App.tsx` | `capture` 상태, `onCaptured` → 생성 화면 전이 |
| `src/i18n/messages/{ko,en}.ts` | 메시지 21개 추가 |
| `src/styles/global.css` | 스크립트 카드, 녹음기, 미리 듣기 스타일 |

## 주요 구현

- **스크립트**: `pickScript(locale, excludeId, random)`는 같은 글이 연속으로 나오지 않게 하고, `random` 주입으로 테스트한다. 카드에 "발췌"와 "저작권이 만료된 작품"을 표시한다.
- **훅 상태 머신**: `start()`가 `getUserMedia` → `MediaRecorder` 생성 → `AudioContext`/`AnalyserNode` 연결 → `recorder.start(250)` 순으로 진행한다. `requestAnimationFrame` 루프가 경과 시간을 재고 50ms마다 레벨을 갱신하며, `maxMs`에 닿으면 `stop()`을 부른다. `onstop`에서 Blob을 합쳐 `Recording`을 만들고 트랙·컨텍스트를 해제한다. `reset()`과 언마운트 정리는 `onstop` 핸들러를 떼고 멈춰 뒤늦은 상태 갱신을 막는다.
- **mime 선택**: `isTypeSupported`가 예외를 던지는 브라우저를 대비해 try/catch로 후보를 순회한다. Chrome은 `audio/webm;codecs=opus`, Safari는 `audio/mp4`.
- **오류 분류**: `NotAllowedError`→권한, `NotFoundError`→장치 없음, `NotReadableError`→사용 중, `NotSupportedError`→미지원, 그 밖은 unknown. 각각 사용자가 할 수 있는 조치를 문구로 안내한다.
- **언어 전환과 스크립트**: effect 대신 렌더 중 상태 조정으로 로케일이 바뀌면 즉시 그 언어의 글로 바꾼다. 녹음 중(`recording`/`requesting`)과 녹음 완료(`done`) 상태에서는 읽은 글과 결과가 어긋나지 않도록 유지하고, 다시 녹음(`idle`)할 때 바꾼다.
- **미리 듣기**: `URL.createObjectURL`을 `useMemo`로 만들고 녹음이 바뀌거나 화면이 사라질 때 `revokeObjectURL`한다.
- **접근성**: 녹음 버튼은 상태별 `aria-label`(녹음 시작/끝내기), 힌트는 `role="status"`, 스크립트 카드는 `lang` 속성으로 언어를 표시한다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 언어 전환 시 "녹음 중 제외"하고 교체 | 녹음 완료 상태에서도 유지 | 녹음이 끝난 뒤 글이 바뀌면 사용자가 읽은 글과 카드가 어긋난다. |
| `useEffect`로 스크립트 동기화 | 렌더 중 상태 조정 | oxlint `react/set-state-in-effect` 경고. effect 없이 같은 결과를 더 적은 렌더로 얻는다. |
| 오류 4종 | 5종(`busy` 추가) | 다른 앱이 마이크를 점유한 경우(`NotReadableError`)는 조치가 다르다. |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 |
| 린트 | `npm run lint` | 경고 0, 오류 0 |
| 단위 테스트 | `npm test` | 7 파일 32 테스트 통과 |
| 빌드 | `npm run build` | 통과 |
| 스크립트 카드 | 브라우저 | 제목·저자·연도·발췌 배지·본문·안내 표시. "다른 글" 클릭 시 다른 글로 교체(청포도 → 서시). English 전환 시 영어 글로 교체(`lang="en"`) |
| 녹음 | 브라우저, `getUserMedia`를 150Hz 합성 스트림으로 대체 | 시작 후 타이머 `0:04 / 0:30`, 레벨 링 `scale(1.25)`, 힌트 "읽는 중…", 다른 글 버튼 비활성. 정지 후 미리 듣기 `<audio>`(blob URL), "다시 녹음"·"생성하기" 표시 |
| 생성하기 전이 | 브라우저 | 생성 화면 제목과 『서시』 낭독 안내, 진행 표시 "생성" |
| 짧은 녹음 | 브라우저 | 1초 녹음 후 "3초 이상 녹음해 주세요"(오류 색), 생성하기 비활성 |
| 권한 거부 | 브라우저, `NotAllowedError` 던지는 스텁 | 권한 안내 문구, "다시 시도" 버튼, 타이머 0:00 |
| 자동 종료 | 브라우저 | 30초 경과 시 자동 정지, 타이머 `0:30 / 0:30`, 트랙 `ended` |
| 자원 해제 | 브라우저 | 녹음 중 "뒤로" 클릭 시 트랙이 `live` → `ended`, 메인 화면 복귀 |
| 모바일 375px | 브라우저 | 아래 리뷰 문서의 구현자 확인 참조 |
