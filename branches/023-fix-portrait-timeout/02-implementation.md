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

## 배포 후 확인

023·024·025를 main에 함께 병합(`4399733`)해 2026-10-20 16:11:05 KST에 푸시했다. Cloudflare Workers Builds가 자동 배포했다(배포 기록 07:11:32Z, 버전 `6f1ef7ab-4545-40f7-8998-35e5a8f4d3a1`). 배포 주소의 번들이 16:11:42 KST에 새 빌드(`index-np10x9bi.js`)로 바뀐 것을 확인했다.

16:11:59 KST, `https://vocatype.hs827.workers.dev`:

| 확인 | 결과 |
| --- | --- |
| `GET /`, `GET /api/health` | 200, 200 |
| `GET /api/config` | `{"provider":"workers-ai","textProviders":["claude","workers-ai"],"features":{"portrait":true,"reading":true}}` |
| 배포된 CSS(`index-CpSgsQrj.css`) | `.voice-loader__bar` 규칙과 `@keyframes voice-loader-wave` 있음(025) |
| 배포된 JS | 초상 실패 문구 "이번에는 AI 초상을 만들지 못해 목소리의 컬러와 사운드 시그니처로 그렸어요." 있음(025) |
| `POST /api/reading` ko `CLME` 1회 | 200, 3.6초, `provider: "claude"`. 4문장 163자, 캡션 22자("서리 내린 아침, 조용히 펼쳐지는 목소리"), "당신"·숫자 없음(024 배분 뒤에도 정상 경로 그대로) |

- 초상(`/api/portrait`)은 호출하지 않았다. 무료 할당량(1장 약 1,450뉴런)을 쓰고, 오늘은 이미 소진돼 있었다. 45초 상한(023)은 단위 테스트로만 확인했다.
- Claude 느린 실패 경로(024)는 운영에서 만들 수 없어 단위 테스트로만 확인했다.
- 음파 로더(025)는 마이크 녹음이 있어야 화면에 들어가므로, 배포본에서는 CSS·JS에 들어 있는지까지 확인했다. 실제 화면은 구현 때 내장 브라우저에서 확인했다.
