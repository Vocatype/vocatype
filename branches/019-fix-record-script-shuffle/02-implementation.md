# 019 fix/record-script-shuffle — 구현 문서

## 요약

설계 안 A대로 '다른 글' 버튼을 녹음이 있는 동안(`requesting`·`recording`·`done`) 비활성으로 바꿨다. 글 고정 조건을 `scriptLocked` 하나로 이름 붙여 기존 언어 전환 규칙과 버튼이 같은 조건을 쓴다. 녹음 훅·`shuffle`·알림은 바꾸지 않았다.
`RecordScreen`의 정적 렌더 테스트 12개를 추가했다(테스트 파일 29 → 30, 테스트 193 → 205). 수정 전 조건으로 되돌리면 `done` 테스트 4개가 실패한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/screens/RecordScreen.tsx` | `const scriptLocked = status !== 'idle' && status !== 'error'` 추가. 언어 전환 조건 `(status === 'idle' \|\| status === 'error')` → `!scriptLocked`(같은 뜻), 버튼 `disabled={isBusy}` → `disabled={scriptLocked}`. 버튼에만 쓰이던 `isBusy` 제거. 주석을 조건 정의 위로 옮김 |
| `src/screens/RecordScreen.test.tsx` | 신설. `vi.hoisted` + `vi.mock('../features/recorder/useRecorder')`로 훅을 상태만 돌려주는 가짜로 바꾸고, `I18nProvider initialLocale`로 감싸 `renderToStaticMarkup`. 헬퍼 `button(html, label)`은 안쪽 텍스트가 정확히 `label`인 `<button>`의 속성을 돌려준다 |
| `branches/019-fix-record-script-shuffle/` | 설계·구현·리뷰 문서 |

## 테스트 목록 (ko·en 각각, 총 12개)

| 테스트 | 상태 | 확인하는 것 |
| --- | --- | --- |
| 녹음이 없는 %s에서는 누를 수 있다 | `idle`, `error`(`permission-denied`) | '다른 글' 버튼이 있고 `disabled`가 없다 |
| 녹음을 시작한 %s에서는 비활성이다 | `requesting`, `recording` | `disabled`가 있다(기존 동작 유지) |
| 녹음이 끝나 생성할 수 있는 done에서도 비활성이다 | `done`, 12초 녹음 | '생성하기'가 활성임을 먼저 확인(결함이 일어나던 상태), '다른 글'은 `disabled` |
| 너무 짧게 끝난 done에서도 비활성이다 | `done`, 최소 길이 − 1ms | '생성하기'·'다른 글' 모두 `disabled` |

버튼 문구는 `messages[locale]`에서 가져온다. 문구에 이스케이프되는 문자가 생기면 `button()`이 null을 돌려 테스트가 조용히 통과하지 않고 실패한다(`idle` 테스트의 `not.toBeNull`, 나머지는 `toHaveProperty`가 null에서 실패).

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 상태 5가지 + 짧은 `done` | 같음, ko·en 두 언어로 `describe.each` | 설계대로 |
| — | 가짜 훅을 `vi.hoisted`로 만든 객체의 `state`를 렌더마다 바꿔 끼우는 방식 | `vi.mock`이 파일 맨 위로 끌어올려지므로 팩토리가 바깥 변수를 직접 참조하지 않게 했다. 저장소에서 `vi.mock`을 쓰는 첫 테스트다 |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 단위 테스트 | `npm test` | 종료 코드 0, 30 파일 205 테스트 통과 |
| 타입 검사 | `npm run typecheck` | 종료 코드 0 |
| 린트 | `npm run lint` | 종료 코드 0, 진단 출력 없음 |
| 빌드 | `npm run build` | 종료 코드 0 |

### 구현자 확인

| 항목 | 방법 | 결과 |
| --- | --- | --- |
| 회귀 감지 | 버튼 조건을 수정 전(`status === 'recording' \|\| status === 'requesting'`)으로 임시로 되돌려 새 테스트 실행 | `done` 테스트 4개(ko·en × 생성 가능·너무 짧음) 실패, 나머지 8개 통과. 복원 후 12개 통과 |
| 브라우저 흐름 | `npm run dev`(5174), `getUserMedia`를 150Hz 합성 스트림으로 대체(003과 같은 방법), 한국어 | `idle`: 『향수』, 다른 글 활성 → 녹음 중: 비활성 → 정지 후 `done`: 미리 듣기·생성하기 활성, **다른 글 비활성**(제목 『향수』 유지) |
| 언어 전환 규칙 유지 | `done`에서 English 선택 | 제목 『향수』 유지, 'Show another' 비활성, 알림 없음(기존 규칙대로) |
| 다시 녹음 뒤 | 'Re-record' 클릭 | `idle`, 영어 글 『Invictus』로 교체, 알림 "New text: Invictus", 'Show another' 활성 |
| 알림 유지 | `idle`에서 'Show another' 클릭 | 제목 교체, 알림 "New text: “Hope” is the thing with feathers". 콘솔 오류 없음 |
