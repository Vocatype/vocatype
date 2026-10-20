# 023 fix/portrait-timeout — 설계 문서

## 변경 사유

Worker의 초상 호출(`worker/ai/workersAi.ts`의 `ai.run`)에는 시간 상한이 없다. 클라이언트는 60초(`src/features/ai/client.ts`의 `PORTRAIT_TIMEOUT_MS`) 뒤 포기하고 자리표시 초상으로 넘어가지만, Worker는 응답이 올 때까지 계속 기다리고 그 사이 무료 할당량(뉴런)을 쓸 수 있다. 020 "알려진 한계"와 사용자 결정(2026-10-20 "추천안처럼 45초")에 따라 서버 상한을 둔다.

## 범위

### 포함

- `shared/api.ts`: 초상 시간 규칙. `PORTRAIT_SERVER_TIMEOUT_MS = 45_000`, `PORTRAIT_CLIENT_TIMEOUT_MS = 60_000`. 리딩 시간 규칙(020)과 같은 형식으로 둔다
- `shared/api.test.ts`: 클라이언트 대기 시간이 서버 상한보다 긴지 검사
- `src/features/ai/client.ts`: 지역 상수 `PORTRAIT_TIMEOUT_MS`를 `PORTRAIT_CLIENT_TIMEOUT_MS`로 바꾼다(값 그대로 60초)
- `worker/ai/workersAi.ts`: `ai.run(…, { signal: AbortSignal.timeout(timeoutMs) })`. `createWorkersAiProvider(ai, timeoutMs = PORTRAIT_SERVER_TIMEOUT_MS)`로 테스트에서 짧게 줄 수 있게 한다
- `worker/ai/workersAi.test.ts`: 바인딩에 신호가 넘어가는지, 바인딩이 끝나지 않으면 상한에서 실패하는지
- `README.md`: 초상 절에 서버 상한 한 줄

### 제외

- 클라이언트 동작 변경 없음. 상한에 걸리면 Worker는 지금의 제공자 실패와 같은 503 `provider_failed`를 돌려주고(`worker/index.ts`), 클라이언트는 자리표시 초상으로 진행한다

## 결정과 근거

| 결정 | 근거 |
| --- | --- |
| 45초 | 클라이언트 60초보다 15초 짧다. 상한에 걸리면 503이 바로 클라이언트에 닿고, 45초 직전에 성공해도 최대 4MB(`PORTRAIT_IMAGE_MAX_CHARS`) 응답을 받을 여유가 있다. 정상 초상은 015 실측 3.5초(약 260KB)라 상한과 거리가 멀다. |
| `AiOptions.signal` | 020이 workerd 내장 바인딩 소스로 확인했다: 신호를 추론 요청 fetch에 그대로 건다(`worker/ai/workersAiText.ts` 주석). 끊은 뒤 Cloudflare 쪽 추론이 멈추는지는 바인딩 밖의 일이라 보장하지 않는다. |
| 상수를 `shared/`에 | 리딩 시간 규칙과 같은 자리에서 "서버 < 클라이언트" 관계를 테스트로 묶는다. |

## 검증 계획

1. typecheck / lint / test / build 종료 코드 0
2. 독립 리뷰 1차 → 반영 → 2차 → 병합 가능이면 `--no-ff` 병합
3. 실제 초상 호출은 무료 할당량을 쓰므로 이 작업에서는 하지 않는다(타임아웃 경로는 단위 테스트로 확인)
