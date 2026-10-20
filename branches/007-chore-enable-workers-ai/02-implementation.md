# 007 chore/enable-workers-ai — 구현 문서

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `wrangler.jsonc` | `vars.AI_PROVIDER`: `"mock"` → `"workers-ai"` |
| `worker-configuration.d.ts` | `wrangler types` 재생성. `Env.AI_PROVIDER: "workers-ai"` |

코드 변경 없음.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| typecheck / lint / test(121) / build | 통과 |
| 출력 `dist/worker/wrangler.json` | `"AI_PROVIDER":"workers-ai"` 포함 |
| 배포 후 확인 | 사용자가 배포 주소를 알려주면 `/api/config`, 전체 흐름, seed 결정성을 확인해 리뷰 문서에 기록한다 |
