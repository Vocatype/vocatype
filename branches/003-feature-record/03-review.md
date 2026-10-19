# 003 feature/record — 리뷰 문서

리뷰 대상: `feature/003-record` → `main` 전체 diff.
리뷰 방식: 별도 리뷰 에이전트가 설계·구현 문서와 코드를 읽고 검증 명령을 직접 실행하며, 스크립트 12편의 저작권 상태와 인용 정확성도 확인. 구현자가 결과를 반영.

## 1차 리뷰

### 체크리스트

| 항목 | 결과 |
| --- | --- |
| `useRecorder` 자원 안전성·상태 머신 | **결함 발견** (Major 1~4) |
| 퍼블릭 도메인·인용 정확성 | 12편 모두 안전. Daffodils 연도만 정정(9) |
| 접근성 | 개선 필요 (7, 8) |
| i18n | 키 모두 존재. 영어 문구 일부 정리(14) |
| 개인정보 (네트워크·저장소·로깅) | 문제 없음 |
| 문서 정확성 | 불일치 (11) |
| typecheck / lint / test / build | 모두 통과 |

### 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 (커밋 `7b3bfc5`) |
| --- | --- | --- | --- | --- |
| 1 | major | `useRecorder.ts` | 권한 프롬프트 중 "뒤로"로 언마운트되면 그 뒤 열린 스트림·레코더·컨텍스트가 그대로 남아 마이크가 최대 30초 켜짐 | 세대 토큰. `getUserMedia` 뒤 세대가 바뀌었으면 트랙을 즉시 닫고 중단 |
| 2 | major | `useRecorder.ts` | `recorder.start(250)`이 try 밖이라 예외 시 `requesting`에 고착, 자원 누수 | try/catch → 자원 해제 + `error` |
| 3 | major | `useRecorder.ts` | `onerror` 뒤 이어지는 `stop` 이벤트가 상태를 `done`(빈 Blob)으로 덮어씀 | `onerror`에서 핸들러를 먼저 떼고 정리. `reset`·언마운트도 `onerror` 해제 |
| 4 | major | `useRecorder.ts` | 자동 종료가 rAF에만 의존해 탭이 숨겨지면 30초를 넘겨 녹음 | `setTimeout(stop, maxMs)` 권위 타이머, rAF는 표시 전용. 표시 경과 시간은 `maxMs`로 상한 |
| 5 | minor | `useRecorder.ts` | Safari에서 제스처 밖 `AudioContext`가 suspended로 시작해 레벨 링이 0 | 생성 직후 `resume()` |
| 6 | minor | `RecordScreen.tsx` | `useMemo` 안의 `createObjectURL`이 StrictMode에서 두 번 생성 | 훅이 `onstop`에서 만들고 `reset`·언마운트 때 해제. 화면은 `previewUrl`만 사용 |
| 7 | minor | `RecordScreen.tsx` | `aria-live` 영역에 시 전문과 버튼이 들어가 글이 바뀔 때마다 전체 낭독 | `aria-live` 제거. 숨김 `role="status"`에 "새 글: 제목"만 알림 |
| 8 | minor | `RecordScreen.tsx` | 권한 대기 중 `disabled`로 키보드 초점 소실 | `aria-disabled` + 클릭 무시 |
| 9 | minor | `scripts.ts` | Daffodils 본문은 1815 개정판인데 연도 1807 | `1815` |
| 10 | minor | `global.css` | 녹음 색 하드코딩, 링(보라)과 버튼(빨강) 불일치 | `--recording` 토큰, 녹음 중 링도 같은 색 |
| 11 | minor | 문서 | "오류 4종→5종" 오기, mime 후보 수 불일치, 존재하지 않는 리뷰 문서 참조, 한국 PD 기준 표현 | 설계·구현 문서 정정 |
| 12 | nit | `scripts.ts` | `estimateReadingSeconds`가 테스트에서만 쓰임 | 카드 메타에 "낭독 약 n초" 표시 |
| 13 | nit | `scripts.ts` | 제목·본문 따옴표 혼용, 별 헤는 밤 발췌 종결 어색 | 따옴표 통일, 마지막 행("어머님, 나는 별 하나에…") 추가 |
| 14 | nit | `en.ts` | "Another text", `record.redo`와 `common.retry` 중복 | "Show another", "Re-record" |
| 15 | nit | `RecordScreen.tsx` | 렌더 중 `Math.random` | 동작 문제 없어 유지. 로케일 전환 시 한 번만 호출 |
| 16 | nit | `App.tsx` | 메인 복귀 후에도 녹음 Blob이 메모리에 남음 | `landing` 전이 시 `capture` 폐기 |

### 1차 결론

**수정 필요.** Major 1~4 반영 후 2차 리뷰. (5~16도 같은 커밋에 반영)

### 1차 반영 후 구현자 확인

- typecheck / lint / test(32) / build 통과
- 권한 응답을 1.5초 지연시킨 스텁으로 "마이크 권한을 확인하는 중…" 상태에서 "뒤로" → 메인 복귀 후 스트림이 열리자마자 `ended`
- 2.5초 녹음 → 미리 듣기 blob URL 생성, 생성하기 비활성(3초 미만). "다시 녹음" 후 이전 URL `fetch` 실패(해제 확인), `<audio>` 제거
- 자동 종료: 30초 후 `0:30 / 0:30`, 트랙 `ended`, 완료 힌트
- 카드 메타에 "낭독 약 35초" 표시(님의 침묵). 녹음 버튼 `aria-disabled="true"` 상태에서 초점 유지
