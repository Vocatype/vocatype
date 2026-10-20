# 023 fix/portrait-timeout — 구현 문서

## 요약

Worker의 Workers AI 초상 호출에 45초 상한을 걸었다. 상한에 걸리면 바인딩 호출이 신호로 끊겨 `TimeoutError`로 실패하고, 라우트는 기존 제공자 실패와 같은 503 `provider_failed`로 답한다. 클라이언트는 60초까지 기다리므로 그 503을 받아 자리표시 초상으로 진행한다. 클라이언트 동작은 바뀌지 않는다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `shared/api.ts` | 초상 시간 규칙 주석과 `PORTRAIT_SERVER_TIMEOUT_MS = 45_000`, `PORTRAIT_CLIENT_TIMEOUT_MS = 60_000` |
| `shared/api.test.ts` | "초상 시간 규칙": 클라이언트 대기 시간 > 서버 상한 |
| `worker/ai/workersAi.ts` | `createWorkersAiProvider(ai, timeoutMs = PORTRAIT_SERVER_TIMEOUT_MS)`, `ai.run(model, inputs, { signal: AbortSignal.timeout(timeoutMs) })`, 신호 동작 주석 |
| `worker/ai/workersAi.test.ts` | 기존 호출 형태 테스트에 옵션 인자 추가, 새 테스트 2건(기본 상한 신호 전달, 끝나지 않는 바인딩이 상한에서 `TimeoutError`로 실패) |
| `src/features/ai/client.ts` | 지역 상수 `PORTRAIT_TIMEOUT_MS = 60000` 삭제, `PORTRAIT_CLIENT_TIMEOUT_MS` 사용(값 동일) |
| `README.md` | 초상 확인 절에 서버 상한·클라이언트 대기 시간 한 줄 |

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` | 종료 코드 0 |
| `npm run lint` | 종료 코드 0 |
| `npm test` | 종료 코드 0, 36 파일 278 테스트 |
| `npm run build` | 종료 코드 0 |

- 첫 테스트 실행에서 기존 호출 형태 테스트 1건이 실패했다. 가짜 바인딩이 셋째 인자(옵션)를 기록하지 않아서였고, 가짜가 옵션까지 기록하게 고쳐 통과했다.
- 실제 초상 호출은 무료 할당량(1장 약 1,450뉴런)을 쓰므로 하지 않았다. 타임아웃 경로는 신호를 존중하는 가짜 바인딩으로 확인했다.

## 알려진 한계

- 끊은 뒤 Cloudflare 쪽 이미지 생성이 멈추는지는 바인딩 밖의 일이라 보장하지 않는다. 상한은 Worker가 오래 붙잡혀 있지 않게 하는 장치다.
