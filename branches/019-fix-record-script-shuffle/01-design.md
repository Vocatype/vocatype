# 019 fix/record-script-shuffle — 설계 문서

## 배경

2026-10-20 구조 리뷰에서 녹음 흐름을 따라가다 발견한 결함.
`RecordScreen`의 '다른 글' 버튼은 `isBusy`(상태 `recording`·`requesting`)일 때만 비활성이다. 녹음이 끝난 `done`에서도 눌리고, `shuffle()`은 `setScript`만 해 녹음은 그대로 남는다.
그 상태에서 '생성하기'를 누르면 `onCaptured({ script, recording })`가 **사용자가 읽지 않은 글**을 넘긴다. 결과 화면 머리글(『제목』 낭독)과 저장 카드는 `present.ts`의 `capture.script.title`을 쓰므로 틀린 제목이 나온다.

같은 파일의 언어 전환 규칙(41~47줄)은 이미 "녹음 중이거나 녹음이 끝난 뒤에는 읽은 글과 결과가 어긋나지 않게 유지하고, 다시 녹음할 때 바꾼다"(`idle`·`error`에서만 교체)를 지키고 있다. 버튼만 이 규칙을 따르지 않는다.

## 목표

녹음이 시작된 뒤(권한 요청 포함)부터 '다시 녹음'으로 `idle`이 될 때까지 읽을 글이 바뀌지 않게 한다. 넘겨지는 `Capture.script`는 항상 사용자가 읽은 글이어야 한다.

## 범위

### 포함

- `src/screens/RecordScreen.tsx`: 글 고정 조건을 `scriptLocked = status !== 'idle' && status !== 'error'` 하나로 이름 붙여, 언어 전환 규칙과 '다른 글' 버튼의 `disabled`가 같은 조건을 쓰게 한다. 버튼에만 쓰이던 `isBusy`는 제거.
- `src/screens/RecordScreen.test.tsx` 신설: `useRecorder`를 `vi.mock`으로 바꿔 상태별로 정적 렌더하고 '다른 글' 버튼의 `disabled`를 검사한다.

### 제외

- `useRecorder` 변경. 훅은 그대로 둔다.
- 비활성 이유를 알리는 새 문구. `done`의 안내("들어 보고 괜찮으면 생성하기를 눌러요")와 '다시 녹음' 버튼이 이미 다음 행동을 알려 준다. 필요하면 별도 작업.
- 클릭 뒤 동작(실제 `onCaptured` 인자) 검사. DOM 이벤트가 필요해 jsdom 없이 할 수 없다. 버튼이 눌릴 수 없음을 렌더로 고정한다.

## 선택지와 결정

| 안 | 내용 | 판단 |
| --- | --- | --- |
| A. 녹음이 있으면 버튼 비활성 | `disabled`를 언어 전환 규칙과 같은 조건(`idle`·`error`가 아니면 고정)으로 | **채택** |
| B. `shuffle`이 `recorder.reset()` | 글을 바꾸면 이전 녹음을 버리고 `idle`로 | 기각 |

A를 고른 근거:

1. **이미 있는 규칙과 일치.** 언어 전환은 `done`에서 글을 유지하고 '다시 녹음' 뒤에 바꾼다. A는 버튼을 같은 조건에 묶어 "글은 녹음이 없을 때만 바뀐다"는 규칙 하나로 정리한다. B는 언어 전환은 녹음을 지키고 '다른 글'은 녹음을 버리는, 서로 다른 두 규칙을 만든다.
2. **한 번 탭으로 녹음을 잃지 않는다.** B는 확인 없이 고스트 버튼 한 번에 20~30초 녹음을 버린다. 녹음을 버리는 동작은 이미 '다시 녹음'이라는 명시적 버튼이 맡고 있다.
3. **변경이 가장 작다.** 조건식 하나와 `disabled` 값 하나. 훅·상태 흐름은 그대로다.
4. **알림이 겹치지 않는다.** B는 `shuffle` 한 번에 `role="status"` 두 곳(새 글 알림, 녹음 안내가 `doneHint` → `idleHint`)이 동시에 바뀐다. A는 기존 알림 동작이 그대로다.

A의 비용: `done`에서 다른 글을 읽고 싶으면 '다시 녹음'을 먼저 눌러야 한다. 언어 전환이 이미 같은 순서를 요구하므로 새 제약이 아니다.

`requesting`·`recording`에서 비활성인 기존 동작은 그대로다(`scriptLocked`가 포함). `error`는 녹음이 없으므로(`recording: null`) 지금처럼 활성이다.

## 접근성

- 새 글 알림(`record.newScript`, 시각 숨김 `role="status"`)은 `shuffle`과 언어 전환에서 지금과 같은 문구·시점으로 나온다. `shuffle`은 바꾸지 않는다.
- 버튼은 지금처럼 네이티브 `disabled`를 쓴다(`Button` 컴포넌트가 그대로 전달). `requesting`·`recording`에서 이미 쓰던 방식과 같다.

## 검증 계획

- 새 테스트(`RecordScreen.test.tsx`): 상태 5가지(`idle`, `error`, `requesting`, `recording`, `done`)와 `done`+최소 길이 미만 녹음에서 '다른 글' 버튼의 `disabled` 유무를 단언. `done`에서는 '생성하기' 버튼이 활성으로 함께 있음을 확인해, 결함이 일어나던 바로 그 상태를 검사하고 있음을 보인다. ko·en 두 언어로.
- 회귀 감지 확인(구현자 확인 행): 수정 전 조건(`isBusy`)으로 되돌리면 `done` 테스트가 실패하는지 한 번 본다.
- `npm test`, `npm run typecheck`, `npm run lint` 종료 코드 0.
