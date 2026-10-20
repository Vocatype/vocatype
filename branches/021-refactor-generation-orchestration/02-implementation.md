# 021 refactor/generation-orchestration — 구현 문서

## 요약

`GeneratingScreen`의 `useEffect` 안에 있던 생성 흐름(분석 → 설정 → 초상·리딩 병렬 요청 → 단계 전환 → 취소 확인)을 React와 무관한 `runGeneration`(`src/features/ai/generate.ts`)으로 옮겼다. `GenerationResult` 타입도 함께 옮겼다.
화면에는 표시 규칙(최소 표시 시간 1400ms, 진행률 ×0.85·0.9, 실패 표시)만 남았다.
`runGeneration` 테스트 21개를 추가했다(테스트 파일 29 → 30, 테스트 193 → 214). 흐름 규칙을 하나씩 깨는 회귀 13건이 모두 테스트에 잡혔다. 1차·2차 리뷰(03 문서) 반영분이 들어 있다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/features/ai/generate.ts` | 신설. `GenerationResult`, `WaitingStage`, `GenerateOptions`, `runGeneration` |
| `src/screens/GeneratingScreen.tsx` | 흐름 코드를 `runGeneration` 호출로 바꿈. `GenerationResult` 정의 제거(새 파일에서 import), `Stage = AnalysisStage \| WaitingStage`, 쓰지 않게 된 import(`client`·`reading`·`analyzeRecording`·`VoiceProfile`) 제거 |
| `src/features/ai/generate.test.ts` | 신설. 테스트 21개 |
| `branches/021-refactor-generation-orchestration/` | 설계·구현·리뷰 문서 |

`App.tsx`는 `GenerationResult`를 이름으로 import하지 않고 콜백 인자를 구조 분해만 하므로 바뀌지 않았다.

## 주요 구현 내용

### `runGeneration`

설계의 순서를 그대로 따른다. 원래 `useEffect` 코드와 다른 점은 아래 세 가지뿐이다.

| 원래(화면) | 지금(`runGeneration`) | 화면에서 보이는 동작 |
| --- | --- | --- |
| `if (signal.aborted) return` (세 곳) | `signal?.throwIfAborted()` (세 곳) | 같다. 화면의 `catch`가 `signal.aborted`일 때 아무것도 하지 않는다 |
| `localeRef.current`를 요청 순간에 읽음 | `getLocale()`을 요청 순간에 부름. 화면은 `() => localeRef.current`를 넘긴다 | 같다 |
| 진행 콜백 안에서 `!signal.aborted`일 때만 `setProgress` | `runGeneration`이 취소 뒤에는 `onProgress`·`onStage`(단계 전환)를 부르지 않음. 화면 콜백은 `setProgress`만 부름 | 같다 |

### 화면

```ts
const result = await runGeneration(capture, {
  getLocale: () => localeRef.current,
  signal,
  onProgress: (next) => setProgress({ stage: next.stage, value: next.progress * 0.85 }),
  onStage: (stage) => setProgress({ stage, value: 0.9 }),
})
// 최소 표시 시간 → 취소 확인 → profiling·1 → onGeneratedRef.current(result)
```

`startedAt`은 전처럼 `runGeneration`을 부르기 전에 잰다. `run().catch(() => { if (!signal.aborted) setFailed(true) })`와 정리 함수의 `controller.abort()`는 그대로다.

## 테스트 목록 (설계 항목 ↔ 테스트)

공통 픽스처: 낭독 언어 `en`, 화면 언어 `ko`(분석과 리딩이 각자 맞는 언어를 받는지 가려낸다). 축은 소수 넷째 자리까지 있어 리딩 본문에서 반올림되는지 보인다.
분석은 `vi.mock('../analysis/analyze')`, 요청은 경로별 `fetch` 스텁이며 `requestPortrait`·`requestReading`·`fetchAiConfig`는 실제 코드를 거친다.

| 설계 | 테스트 | 확인하는 것 |
| --- | --- | --- |
| 1 | 설정 조회를 분석과 동시에 시작하고, 분석 진행을 전달한 뒤 켜진 요청을 보내 결과를 모은다 | 분석이 불릴 때 이미 `/api/config` 요청이 나가 있음, 분석이 녹음·낭독 언어(`en`)·같은 신호 객체(`toBe`, 1차 리뷰 #1)를 받음, 진행 전달, 첫 단계 `portrait`, 초상 본문 `{ typeCode, seed }`·리딩 본문 `{ typeCode, 반올림 축, locale: 'ko' }`(키 정확히 일치), 요청 신호 전달, 결과 |
| 10 | 리딩 언어는 요청을 보내는 순간에 읽는다 | 분석 중에 `ko` → `en`으로 바꾸면 리딩 본문과 결과가 `en` |
| 3 | 초상만 켜짐 | 요청 `[config, portrait]`, 단계 `['portrait']`, 리딩 null |
| 4 | 리딩만 켜짐 | 요청 `[config, reading]`, 단계 `['reading']`, 초상 null |
| 5 | 둘 다 꺼짐 / 설정 조회 실패(꺼진 설정으로 봄) | 요청 `[config]`, 단계 없음, 둘 다 null |
| 2 | low-signal 녹음은 리딩이 켜져 있어도 리딩을 요청하지 않는다 | 요청 `[config, portrait]`, 단계 `['portrait']`, 리딩 null, `getLocale` 호출 없음 |
| 2 | low-signal 이고 초상이 꺼져 있으면 요청도 대기 단계도 없다 | 요청 `[config]`, 단계 없음 |
| 6 | 초상이 먼저 끝나면 리딩을 기다리는 동안 단계를 리딩으로 바꾼다 | 응답을 직접 풀어 순서를 정함. 초상 응답 뒤 단계 `['portrait', 'reading']`, 리딩 응답 뒤 결과 |
| 6 | 초상이 실패로 먼저 끝나도 리딩을 기다리면 단계를 리딩으로 바꾼다 | 초상 HTTP 오류 + 리딩 보류. 단계 `['portrait', 'reading']`, 결과의 초상 null(1차 리뷰 #2) |
| 6 | 리딩이 실패로 먼저 끝난 뒤 초상이 끝나도 단계를 바꾸지 않는다 | 초상 보류 + 리딩 HTTP 오류 → 초상 응답. 단계 `['portrait']`, 리딩 null(2차 리뷰 N1. 원본의 `.finally`는 결과와 무관하게 리딩을 끝난 것으로 본다) |
| 6 | 리딩이 먼저 끝나면 단계를 바꾸지 않는다 | 리딩 응답 → 대기 → 초상 응답. 단계 `['portrait']` |
| 7 | 초상 HTTP 오류 / 초상 네트워크 오류 / 리딩 HTTP 오류 / 리딩 네트워크 오류 / 둘 다 실패 | 거부하지 않고 해당 값만 null, 프로필은 그대로 |
| 9 | 분석이 실패하면 그 오류로 거부하고 초상·리딩은 요청하지 않는다 | 같은 오류 객체로 거부, 요청 `[config]`, 단계 없음 |
| 8 | 분석 중에 취소되면 설정을 기다리지 않고 바로 거부하며, 요청도 그 뒤 분석 진행 전달도 없다 | 설정 응답이 끝내 오지 않아도 AbortError로 거부, 취소 뒤 진행 콜백 없음, 요청 `[config]` |
| 8 | 설정을 기다리는 중에 취소되면 설정이 와도 초상·리딩 요청과 대기 단계 없이 거부한다 | 분석 완료 → 취소 → 설정 응답. 요청 `[config]`, 단계 없음 |
| 8 | 요청 중에 취소되면 두 요청을 끊고, 초상이 먼저 끝나도 리딩 단계로 바꾸지 않고 거부한다 | 두 요청의 `fetch` 신호가 끊김, 단계 `['portrait']`에서 그대로, AbortError |

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 검사 항목 10개 | 테스트 21개 | 기능 조합 4가지와 실패 5가지를 `it.each`로 펼쳤고, 1차 리뷰 #2로 "초상 실패 먼저", 2차 리뷰 N1로 "리딩 실패 먼저" 전환 테스트를 더했다 |
| 분석 중 취소: "분석이 끝나도 요청 없음" | + 설정 응답이 오지 않아도 바로 거부 | 처음 쓴 테스트는 설정이 바로 와서, 분석 직후 취소 확인을 지워도 설정 뒤 확인이 대신 잡아 통과했다. 원래 코드도 분석 직후 `return`해 설정을 기다리지 않았으므로 그 동작을 고정했다(아래 회귀 4번) |
| (없음) | low-signal에서 `getLocale`을 부르지 않음 단언 | 리딩을 요청하지 않으면 언어도 읽지 않는다는 "요청 순간에 읽는다"의 반대쪽 |
| 분석 인자를 `toMatchObject({ locale, signal })`로 | `locale`은 `toBe('en')`, `signal`은 `toBe(controller.signal)` | 1차 리뷰 #1. `toMatchObject`는 `AbortSignal` 둘을 구조로 비교해 다른 신호도 통과시켰다(분석에 엉뚱한 신호를 넘기는 회귀가 통과) |
| `untilAborted` 스텁은 `abort` 이벤트만 들음 | 이미 끊긴 신호면 바로 거부 | 1차 리뷰 #3. 실제 `fetch`와 같게. 지금 이 경로를 타는 테스트는 없지만 스텁이 실제와 어긋나지 않게 했다 |
| 언어 타입 `ReadingLocale`(`shared/api`) | `Locale`(`src/i18n/locales`) | 2차 리뷰 뒤. 같은 날 진행 중인 020이 `ReadingLocale`을 지운다. 두 타입은 지금 같은 `'ko' \| 'en'`이고 `Locale`은 main에 이미 있으며 `analyze.ts`도 같은 곳에서 가져오므로, 이렇게 두면 020과 021을 어느 순서로 병합해도 타입 검사가 깨지지 않는다 |
| "단계 전환" 테스트에서 응답 처리 대기 | `settle()`(매크로태스크 5번)을 두 테스트에 똑같이 씀 | "초상 먼저" 테스트가 같은 `settle()`로 전환까지 흘러감을 보이므로, "리딩 먼저" 테스트의 음성 단언(전환 없음)이 대기 부족으로 거짓 통과하지 않는다 |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 종료 코드 0 |
| 린트 | `npm run lint` | 종료 코드 0, 출력 없음 |
| 단위 테스트 | `npm test` | 30 파일 214 테스트 통과, 종료 코드 0 |
| 빌드 | `npm run build` | 종료 코드 0 |
| 반복 실행 | `npx vitest run src/features/ai/generate.test.ts` 3회 | 매번 21개 통과 |

### 회귀 감지 (구현자 확인)

`generate.ts`를 한 군데씩 바꿔 새 테스트 파일을 돌리고 원본으로 되돌렸다(마지막에 원본과 같음을 확인). 13건 모두 1개 이상 실패했다. 14·15번은 1차, 16번은 2차 리뷰에서 리뷰어가 찾은 놓친 회귀로, 테스트를 보강한 뒤 다시 넣어 잡히는지 확인했다.

| # | 회귀 | 실패한 테스트 |
| --- | --- | --- |
| 1 | 단계 전환 조건에서 `!readingSettled` 제거 | 리딩이 먼저 끝나면 단계를 바꾸지 않는다 |
| 2 | 단계 전환 조건에서 취소 확인 제거 | 요청 중 취소 |
| 3 | 단계 전환 조건에서 `wantPortrait && wantReading` 제거 | 기능 조합 4개, low-signal 2개 |
| 4 | 분석 직후 `throwIfAborted` 제거 | 분석 중 취소(설정을 기다리느라 거부가 늦어짐) |
| 5 | 설정 뒤 `throwIfAborted` 제거 | 설정 대기 중 취소 |
| 6 | 요청 뒤 `throwIfAborted` 제거 | 요청 중 취소 |
| 7 | 분석 진행 콜백의 취소 가드 제거 | 분석 중 취소 |
| 8 | `planGeneration`에 품질 대신 `'ok'` | low-signal 2개 |
| 9 | 설정 조회를 분석 뒤로 미룸 | 정상 흐름, 분석 실패, 분석 중 취소 |
| 10 | 언어를 시작 시점에 한 번 읽음 | 요청 순간의 언어, low-signal(`getLocale` 호출) |
| 11 | 초상 요청에 신호를 넘기지 않음 | 요청 중 취소 |
| 12 | 첫 대기 단계를 알리지 않음 | 7개 |
| 13 | 리딩 축을 반올림하지 않고 보냄 | 정상 흐름 |
| 14 (1차 리뷰 뒤) | 초상이 성공(null 아님)일 때만 리딩으로 전환 | 초상이 실패로 먼저 끝나도 리딩 단계로 바꾼다. 리뷰 전에는 통과했던 회귀 |
| 15 (1차 리뷰 뒤) | 분석에 다른 `AbortController`의 신호를 넘김 | 정상 흐름. 리뷰 전에는 통과했던 회귀 |
| 16 (2차 리뷰 뒤) | 리딩이 성공(null 아님)일 때만 `readingSettled`를 true로 | 리딩이 실패로 먼저 끝난 뒤 초상이 끝나도 단계를 바꾸지 않는다. 리뷰 전에는 통과했던 회귀 |

### 브라우저 확인 (구현자 확인)

개발 서버(`dev-021`, 5181 포트)에서 실제 화면으로 녹음 → 생성 → 결과를 돌렸다.
브라우저 창은 마이크 권한이 `denied`였고, 로컬 개발 서버도 원격 Workers AI를 쓴다(초상 1회 약 1,500뉴런, 형제 세션과 같은 무료 할당량). 그래서 페이지 안에서 검증용 하네스를 걸었다(새로고침하면 사라짐, 코드 변경 없음).

- `getUserMedia` → 합성 목소리 스트림(140Hz 톱니파, 비브라토, 4Hz 진폭 변조). 실제 녹음·디코딩·분석 코드를 그대로 거쳤고 품질은 `ok`(리딩 요청이 나감)였다.
- `/api/portrait`·`/api/reading` → 지연을 정할 수 있는 가짜 응답. `/api/config`는 실제 서버 응답(초상·리딩 켜짐).
- 단계 문구와 진행 막대 속성을 `MutationObserver`로 시각과 함께 기록.

| 확인 | 조건 | 결과 |
| --- | --- | --- |
| 정상 흐름·단계 전환 | 초상 600ms, 리딩 2,500ms | 0ms "녹음을 읽는 중"(0%) → 248ms 두 요청 동시 전송·"초상을 그리는 중"(`aria-valuenow` 없음) → 849ms 초상 응답, 850ms "목소리를 읽는 중" → 리딩 응답 뒤 결과 화면(초상 이미지·리딩 문단 표시) |
| 요청 본문 | 같은 실행 | 초상 `{ seed, typeCode }`, 리딩 `{ axes(소수 둘째 자리), locale: 'ko', typeCode }`뿐 |
| 최소 표시 시간 | 두 응답 즉시 | 요청 138ms에 끝남, 결과 화면은 클릭 뒤 1,437ms(≥ 1,400ms) |
| 생성 중 취소 | 두 응답 30초 | 취소 20ms 뒤 두 요청의 신호가 끊김(`aborted: true`), 녹음 화면으로 돌아감, 실패 문구(`role="alert"`) 없음, "목소리를 읽는 중"으로 바뀌지 않음 |
| 오류 | 콘솔·서버 로그 | 오류 없음 |

실제 Workers AI 응답(이미지·리딩 문장)으로는 확인하지 않았다. 요청 함수와 응답 처리는 이 브랜치에서 바뀌지 않았다.

## 알려진 한계

- 화면 쪽 연결은 단위 테스트가 없다: 표시 규칙(×0.85, 0.9, 1400ms, 실패 표시), `getLocale: () => localeRef.current` 연결, 취소로 끝난 거부를 실패로 보이지 않게 하는 `catch`의 `signal.aborted` 가드(1차 리뷰 #4). 016과 같은 정적 렌더로는 `useEffect`가 돌지 않아 설계에서 범위 밖으로 두었다. 브라우저 확인은 최소 표시 시간(1,437ms), 단계 문구, 대기 단계의 `aria-valuenow` 생략, 취소 가드(취소 뒤 실패 문구 없음)만 대신 확인했다. ×0.85·0.9 진행률 값, 실패 화면 표시, 생성 중 언어 전환은 확인하지 않았다(2차 리뷰 N2로 범위를 좁혀 적음).
- 두 요청이 거의 같은 때 끝나면 "목소리를 읽는 중"이 한 프레임도 그려지지 않을 수 있다(React가 다음 상태와 묶음). 원래 코드와 같은 동작이다.
- 020(locale 단일 출처)과는 글자 충돌이 없고, `Locale`을 쓰도록 바꿔 타입 충돌도 없앴다(설계 대비 달라진 점). 두 브랜치를 함께 병합한 트리의 검사는 03 문서 끝에 있다.
