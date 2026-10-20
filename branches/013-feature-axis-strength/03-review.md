# 013 feature/axis-strength — 리뷰 문서

리뷰 대상: `feature/013-axis-strength` → `main` 전체 diff.
리뷰 방식: 별도 리뷰 에이전트(가벼운 모델)가 설계 문서와 코드를 읽고 검증 명령을 실행했으며, 축 순서와 타입 코드 일치를 0.01 간격 격자로, 캔버스 수치를 스크립트로 실측. 구현자가 반영.

## 1차 리뷰

### 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| 1 | 중간 | `renderCard.ts` | `clampLines`는 줄 수가 한도 이하면 폭 검사를 건너뛰어 1요소 라벨이 말줄임되지 않음(403px 라벨 그대로) | 글자는 남기고 라벨만 `wrapText` → `clampLines(…, 1, 폭, measure)`. 폭은 `barWidth − 퍼센트 폭 − 12` |
| 2 | 중간 | `en.ts` | "with a touch of Measured"처럼 형용사·대문자가 어색 | "A little {other}, too", 영어는 라벨 소문자로 전달 |
| 3 | 중간 | `ResultScreen.tsx` | `aria-valuemin=50`인데 채움 폭은 0~100 기준이라 보조기기 위치 계산이 어긋남, 머리글과 중복 낭독 | 0~100, `aria-valuetext`, 머리글 `aria-hidden`, 경계 안내 `aria-describedby`, `role="list"` |
| 4 | 중간 | `renderCard.ts` | 겨울 쿨 대표색(#1E3A8A)은 어두운 바탕에서 대비 1.8:1로 보이지 않음 | 대표색 휘도 < 0.3이면 밝은 글자색으로 채움 |
| 5 | 중간 | `axisStrength.ts` | 부동소수점 때문에 0.45는 경계, 0.55는 아님. 표시값 55%와 어긋남 | `boundary = percent < 55`(표시값 기준, 대칭). 테스트 추가 |
| 6 | 낮음 | 화면·카드 | 신호 부족(`low-signal`)이면 모두 50%·경계 안내가 나오는 가짜 측정값 | 화면·카드 모두 축 막대 생략 |
| 7 | 낮음 | 코드 정리 | JSDoc 위치, 죽은 `is-boundary` 클래스, 불필요한 `Math.max`, 트랙 대비, `role="list"`, 테스트의 "칩" 문구 | 모두 반영 |
| 8 | 낮음 | 예산 | 최악 조합 여유 24→10px | 유지(이번 범위). 다음 기능 때 간격 재조정 |
| 9 | 테스트 | — | 경계 값·격자 일치·en·low-signal·긴 라벨 말줄임 | 추가(181개) |

### 1차 결론

**수정 필요** → 1~7·9 반영 후 2차.

### 1차 반영 후 구현자 확인

- typecheck / lint / test(181) / build 통과
- 브라우저: meter가 0~100 눈금에 `aria-valuetext`로 읽히고 경계 안내가 `aria-describedby`로 연결됨, 영어 "A little full, too"
