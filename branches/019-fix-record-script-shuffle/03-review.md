# 019 fix/record-script-shuffle — 리뷰 문서

리뷰 대상: `fix/019-record-script-shuffle` → `main` 전체 diff.
리뷰 방식: 별도 리뷰 에이전트가 설계·구현 문서와 코드를 `useRecorder`의 상태 전이 전체와 대조하고, 검증 명령 4종을 종료 코드로 확인했으며, 회귀 13건을 일부러 넣어 테스트가 잡는지 실측했다. 구현자가 반영.

## 1차 리뷰

대상: `c61b3fc`(설계·수정·테스트 12개·구현 문서). 검증 명령 4종 종료 코드 0(30 파일 205 테스트). 새 테스트 3회 반복과 `TZ=America/Los_Angeles LANG=C`에서도 통과.

### 정확성 점검

- `error`로 가는 다섯 경로(미지원, `getUserMedia` 실패, `MediaRecorder` 생성 실패, `onerror`, `recorder.start` 실패)가 모두 `{ ...INITIAL, status: 'error' }`라 `recording: null`이 보장된다. `error`에서 고정을 푸는 것이 맞다.
- 글을 바꾸는 곳은 `shuffle`과 렌더 중 언어 전환 두 곳뿐이고 둘 다 `scriptLocked`로 막힌다.
- `idle` → `requesting`은 `await` 전에 동기로 바뀌어 틈이 없다. `done`에서 다시 녹음 시작, `done`에서 언어 전환 뒤 녹음 시작과 그 직후 권한 실패, 녹음 중 `onerror`, `reset`과 늦게 끝난 `start`(세대 토큰)까지 화면의 글과 `onCaptured`의 글이 어긋나는 경로가 없다.
- `!scriptLocked`는 상태 5가지에서 기존 `idle || error`와 같은 뜻이다.

### 회귀 시도

13건 중 10건이 잡혔다(버튼 조건 되돌림, `recording !== null`만, `status === 'done'`만, `error`도 고정, `disabled` 제거, 생성하기 항상 활성, 안 B 형태, `Button`이 `aria-disabled` 사용, `Button`이 내용을 `<span>`으로 감쌈 → 12개 모두 실패해 `button()`이 조용히 통과하지 않음을 확인).
놓친 3건: 언어 전환 조건 제거(R6)·반전(R7) — 아래 #3, `onCaptured`에 다른 글 전달(R12) — 클릭이 필요해 설계 "제외"에 적은 한계. `scriptLocked = recording !== null || busy`(R13)는 훅의 불변식상 같은 뜻이라 통과가 정상.

### 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| 1 | 낮음 | 01 배경 | 영향을 결과 머리글·저장 카드로만 적음. `GeneratingScreen` 안내(`capture.script.title`)와 분석 언어(`analyzeRecording`의 `locale: capture.script.locale` → 말 빠르기 축 범위)도 영향. `done`에서 언어를 바꾼 뒤 '다른 글'이면 한국어 녹음을 영어 기준으로 분석해 타입 코드까지 틀릴 수 있었다 | 배경에 두 경로 추가 |
| 2 | 낮음 | 01 근거 2 | "녹음을 버리는 동작은 '다시 녹음'이 맡는다"는 부정확. `done`에서 마이크 버튼(`start()`)도 이전 녹음을 버린다. 결론은 유효 | "다시 녹음·녹음 시작처럼 녹음을 다루는 명시적 동작뿐"으로 정정 |
| 3 | 낮음 | `RecordScreen.test.tsx` | 같은 조건으로 다시 쓴 언어 전환 규칙을 지키는 테스트가 없음(R6·R7 통과) | `pickScript` 첫 호출만 영어 글을 돌려주게 해 `idle`·`error`는 ko로 교체+알림, `requesting`·`recording`·`done`은 en 유지+알림 없음을 검사(5개) |
| 4 | nit | 01 근거 4 | 기존에도 `done`에서 언어 전환 뒤 '다시 녹음'이면 `role="status"` 두 곳이 함께 바뀐다. A는 겹침을 없애는 게 아니라 새로 만들지 않을 뿐 | "겹치는 알림을 새로 만들지 않는다"로 표현 조정 |
| 5 | nit | `RecordScreen.tsx` 주석 | "다시 녹음해 idle이 되면 풀린다"만 적혀 있으나 `error`에서도 풀림 | "녹음이 없는 idle(다시 녹음)·error가 되면 풀린다"로 수정 |
| 6 | nit | 02 문서, 01 줄 번호 | ① 없는 `03-review.md`를 변경 파일에 기재(이 문서로 해소) ② "`idle` 테스트의 `not.toBeNull`" 위치 부정확 ③ "41~47줄"은 수정 전 기준 | ② 정정, ③ "(수정 전)" 추가 |
| 7 | nit | 테스트 `vi.mock` 팩토리 | 가짜 훅 반환값이 실제 타입과 대조되지 않음 | `ReturnType<typeof useRecorder>`로 고정, 상태 미설정 시 오류 |

### 1차 결론

**병합 가능**(높음·중간 없음). 낮음·nit 7건은 병합 전에 모두 반영하고 2차에서 확인받기로 함.

### 1차 반영 후 구현자 확인

- 커밋 `da765b0`(테스트 17개, 주석), 이 문서와 01·02 문서 갱신 커밋. typecheck / lint / test(30 파일 210, 종료 코드 0) / build 통과
- 1차에서 놓친 R6(조건 제거)·R7(항상 거짓)과 언어 전환 알림 제거를 다시 넣어 각각 3개·2개·2개 실패함을 확인하고 복원
