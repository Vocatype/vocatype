# 007 chore/enable-workers-ai — 리뷰 문서

## 1차 리뷰 (구현자 자체 리뷰)

설정 한 줄 변경이라 별도 리뷰 에이전트를 쓰지 않고 구현자가 점검했다.

| 항목 | 결과 |
| --- | --- |
| 변경 범위가 설계와 같은가 | `vars.AI_PROVIDER` 한 줄과 생성 타입 파일뿐 |
| 006의 보호 장치가 그대로 적용되는가 | 속도 제한 바인딩·교차 사이트 403·바이트 제한·503 숨김 모두 코드 변경 없음 |
| 개인정보 흐름 변화 | 없음 (타입 코드·씨앗만 전송) |
| 검증 명령 | typecheck / lint / test / build 통과, 출력 설정에 반영 확인 |

### 1차 결론

**병합 가능.** 배포 후 확인(`/api/config`, 실사 초상, seed 결정성)은 사용자가 주소를 알려주면 수행해 아래에 기록한다.

## 최종

- 병합: `git merge --no-ff chore/007-enable-workers-ai` → main
- 브랜치 삭제: `git branch -d chore/007-enable-workers-ai`
