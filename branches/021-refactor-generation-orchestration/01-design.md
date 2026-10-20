# 021 refactor/generation-orchestration — 설계 문서

## 배경

2026-10-20 계층 리뷰는 분리 상태를 "대체로 좋음"으로 봤다. import는 한 방향으로만 흐르고 `features/`는 순수 함수로 테스트되며, Worker도 깔끔하게 나뉘어 있다.
빈 곳은 하나다. `GeneratingScreen`의 `useEffect` 안(약 55~108행)이 "분석 → 설정 → 초상·리딩 병렬 요청" 흐름을 직접 들고 있고, 이 흐름에는 테스트가 없다.
요청 함수(`requestPortrait`·`requestReading`)는 실패해도 거부하지 않고 null을 돌려주며, 무엇을 요청할지는 이미 `planGeneration`(`features/ai/reading.ts`)이 정한다. 남은 것은 순서·병렬·취소·단계 전환 규칙인데, 이 규칙이 화면 코드에 섞여 있어 검사할 수 없다.

## 목표

생성 흐름을 React와 무관한 비동기 함수 `runGeneration`으로 옮기고, Vitest `node` 환경에서 흐름 규칙을 테스트로 고정한다. 화면에서 보이는 동작은 바꾸지 않는다.

## 범위

### 포함

- `src/features/ai/generate.ts` 신설
  - `runGeneration(capture, { getLocale, signal, onProgress, onStage }): Promise<GenerationResult>`
  - `GenerationResult` 타입을 `GeneratingScreen.tsx`에서 이 파일로 옮긴다.
  - `WaitingStage = 'portrait' | 'reading'`(분석 뒤 생성 요청을 기다리는 단계) 타입.
- `src/screens/GeneratingScreen.tsx`: `useEffect`는 `runGeneration` 호출과 표시 규칙만 남긴다.
- `src/features/ai/generate.test.ts` 신설(아래 검증 계획).

### 화면에 남기는 것 (표시 전용 규칙)

- `MIN_DISPLAY_MS`(1400ms) 최소 표시 시간과 그 기준 시각(`startedAt`).
- 진행률 환산: 분석 진행률 × 0.85, 생성 대기 단계는 0.9 고정, 완료 시 `profiling`·1.
- 실패 표시(`setFailed`)와 다시 시도(`attempt`), `AbortController` 생성과 정리 함수의 `abort()`.
- `onGenerated` 최신 참조(`onGeneratedRef`), 화면 언어 최신 참조(`localeRef`).

### 제외

- 요청 함수·`planGeneration`·분석 코드의 변경. 그대로 가져다 쓴다.
- 화면 렌더 테스트. 016처럼 정적 마크업으로는 `useEffect`가 실행되지 않아 흐름을 볼 수 없고, jsdom을 들이지 않는다(흐름은 `runGeneration` 테스트가 본다).
- 진행률 환산 규칙(×0.85, 0.9)을 함수로 빼는 것. 화면 한 곳에서만 쓰는 표시 규칙이다.

## 구조

### `runGeneration` 계약

```ts
export interface GenerateOptions {
  /** 리딩 요청을 보내는 순간에 읽는 화면 언어. */
  getLocale: () => Locale
  /** 취소. 중단되면 AbortError로 거부되고, 그 뒤로는 콜백을 부르지 않는다. */
  signal?: AbortSignal
  /** 기기 안 분석의 진행(analyzeRecording의 진행을 그대로 전달). */
  onProgress?: (progress: AnalysisProgress) => void
  /** 생성 대기 단계. 처음 단계(초상 > 리딩)와, 초상이 먼저 끝났는데 리딩이 남았을 때의 'reading'. */
  onStage?: (stage: WaitingStage) => void
}
```

순서(지금 `useEffect`와 같다):

1. `fetchAiConfig()`를 먼저 시작하고(분석과 대기 시간을 겹친다), 기다리지 않고 분석으로 간다.
2. `analyzeRecording(capture.recording, { locale: capture.script.locale, signal, onProgress })`. 진행 콜백은 취소 뒤에는 전달하지 않는다.
3. 취소 확인 → 설정을 기다림 → 취소 확인.
4. `planGeneration(config.features, profile.quality)`. `plan.stage`가 있으면 `onStage(plan.stage)`.
5. 켜진 요청만 병렬로 보낸다. 초상은 `{ typeCode, seed }`, 리딩은 `{ typeCode, axes: toReadingAxes(axes), locale: getLocale() }`. 끄면 `Promise.resolve(null)`.
6. 둘 다 요청했고 초상이 먼저 끝났으며 리딩이 아직이고 취소되지 않았으면 `onStage('reading')`.
7. 둘 다 기다림 → 취소 확인 → `{ profile, portrait, reading }`.

분석이 실패하면 그 오류로 거부한다(화면은 실패 표시). 요청 함수는 거부하지 않으므로 초상·리딩 실패는 null로 결과에 들어간다.

### 화면

```ts
const result = await runGeneration(capture, {
  getLocale: () => localeRef.current,
  signal,
  onProgress: (next) => setProgress({ stage: next.stage, value: next.progress * 0.85 }),
  onStage: (stage) => setProgress({ stage, value: 0.9 }),
})
// 최소 표시 시간 → 취소 확인 → profiling·1 → onGenerated(result)
```

`run().catch(() => { if (!signal.aborted) setFailed(true) })`는 그대로 둔다. 취소로 거부된 경우는 `signal.aborted`라 실패로 보이지 않는다.

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| 언어를 값 `locale`이 아니라 함수 `getLocale`로 받는다 | 지금은 `localeRef.current`를 리딩 요청을 보내는 순간(분석이 끝난 뒤)에 읽는다. 시작할 때 값으로 받으면 분석 중에 언어를 바꾼 경우 이전 언어로 리딩을 요청하게 되고, 결과 화면의 `visibleReading`이 그 리딩을 숨겨 동작이 달라진다 |
| 취소되면 `undefined`로 끝내지 않고 AbortError로 거부한다(`signal.throwIfAborted()`) | `analyzeRecording`과 같은 계약("중단되면 거부")이라 호출자가 한 가지 방식만 알면 된다. 반환 타입이 `GenerationResult`로 남아 "결과 없음"과 "취소"가 섞이지 않는다. 화면의 `catch`는 이미 `signal.aborted`면 아무것도 하지 않으므로 보이는 동작은 같다 |
| 취소 뒤 콜백 차단을 `runGeneration` 안에서 한다 | 지금 화면은 `onProgress`와 단계 전환에서 `!signal.aborted`를 검사한다. 이 규칙을 함수 계약으로 올려 테스트로 고정하고, 화면 콜백은 `setProgress`만 부른다 |
| 진행 콜백을 둘(`onProgress`·`onStage`)로 나눈다 | 분석은 진행률이 있고 생성 대기는 없다. 한 콜백에 `progress: number \| null`을 섞으면 화면이 null 분기를 다시 만들어야 한다. 0.85·0.9 환산은 화면이 각 콜백에서 한다 |
| 파일 위치 `features/ai/generate.ts` | 흐름의 중심이 AI 요청(설정·계획·초상·리딩)이고 `planGeneration`이 같은 폴더에 있다. 분석은 `features/analysis`에서 가져온다(`features` 사이 import는 이미 있는 방향) |
| 테스트에서 `analyzeRecording`은 `vi.mock`, 요청은 `fetch` 스텁 | `decode.ts`는 `OfflineAudioContext`가 필요해 `node`에서 돌지 않는다. 요청 함수는 실제 코드를 거치게 해서(본문 형식·null 처리) 흐름과 요청 계약이 함께 검사되게 한다. `client.test.ts`와 같은 방식 |

## 검증 계획

`src/features/ai/generate.test.ts`(Vitest `node`):

1. 정상 흐름: 설정 조회가 분석 전에 시작되고, `analyzeRecording`이 녹음·낭독 언어·신호를 받으며, 분석 진행이 그대로 전달되고, 첫 단계는 `portrait`, 초상 본문은 `{ typeCode, seed }`, 리딩 본문은 `{ typeCode, 반올림한 축, locale }`(키 정확히 일치 = 음성·특징값을 보내지 않음), 결과는 `{ profile, portrait, reading }`.
2. low-signal: 기능이 둘 다 켜져 있어도 리딩 요청이 나가지 않는다(초상만, 단계 `portrait`). 초상까지 꺼져 있으면 요청도 단계도 없다.
3. 초상만 켜짐: `/api/reading` 요청 없음, 단계는 `portrait` 하나.
4. 리딩만 켜짐: `/api/portrait` 요청 없음, 단계는 `reading` 하나.
5. 둘 다 꺼짐(설정 조회 실패 포함): 요청·단계 없이 `portrait: null, reading: null`.
6. 단계 전환: 초상이 먼저 끝나면 리딩을 기다리는 동안 `reading`으로 바뀐다. 리딩이 먼저 끝나면 바뀌지 않는다.
7. 실패: 초상 실패(HTTP 오류·네트워크 오류)·리딩 실패·둘 다 실패에서도 거부하지 않고 해당 값만 null.
8. 취소: 분석 중 취소(분석이 끝나도 요청 없음, 이후 진행 콜백 없음), 설정 대기 중 취소(초상·리딩 요청 없음, 단계 없음), 요청 중 취소(요청의 신호가 끊기고, 초상이 먼저 끝나도 `reading` 전환 없음). 모두 AbortError로 거부.
9. 분석 실패는 같은 오류로 거부되고 초상·리딩 요청은 나가지 않는다.
10. 언어: 분석 중에 화면 언어가 바뀌면 바뀐 언어로 리딩을 요청한다.

그 밖에:

- `npm test`(테스트 파일 29 → 30), `npm run typecheck`, `npm run lint`, `npm run build` 통과.
- 회귀 감지 확인(구현자 확인 행): `runGeneration`의 단계 전환 조건·취소 확인·low-signal 처리를 하나씩 일부러 깨 테스트가 실패하는지 본다.
- 동작 동일성(구현자 확인 행): 개발 서버에서 녹음 → 생성 → 결과까지 한 번 돌려 단계 문구와 결과가 전과 같은지, 생성 중 취소가 실패 문구 없이 녹음 화면으로 돌아가는지 본다. 녹음에는 마이크가 필요하므로, 브라우저 창에서 녹음할 수 없으면 그 사실과 대신 확인한 범위를 구현 문서에 적는다.

## 형제 작업과의 관계

같은 날 병렬로 진행 중인 020(`refactor/020-contract-cleanup`, locale 단일 출처)이 `ReadingLocale`·`Locale` 정의를 바꿀 수 있다. 이 브랜치는 언어를 타입으로만 쓰고 두 타입은 지금 같은 합집합(`'ko' | 'en'`)이라, 어느 쪽이 먼저 병합되어도 충돌은 import 줄 수준이다. (2차 리뷰 뒤 정정: 020이 `ReadingLocale`을 지우므로 처음부터 `Locale`(`src/i18n/locales`)을 쓰도록 바꿔 병합 순서와 무관하게 했다. 02 문서 참조)
