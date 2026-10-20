# 024 fix/reading-fallback-reserve — 구현 문서

## 요약

리딩 체인이 뒤에 시도할 제공자 몫으로 12초(`FALLBACK_RESERVE_MS`)를 남기고, 앞 제공자에게는 남은 예산에서 그 몫을 뺀 시간만 중단 신호로 준다. 마지막 제공자는 남은 예산을 다 쓴다. 운영 순서(`claude,workers-ai`)에서는 Claude가 최대 13초, Llama가 약 12초(중단 전파 지연만큼 덜)를 갖는다. Claude가 느리게 실패해도(멈춤·타임아웃·긴 `retry-after`) 13초에서 끊기고 Llama가 답할 수 있다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `worker/ai/textChain.ts` | `FALLBACK_RESERVE_MS = 12_000` 추가, `MIN_REMAINING_MS` 내보냄(테스트용). 반복문이 `providers.entries()`로 위치를 보고 `allowed = 마지막이 아니면 remaining − FALLBACK_RESERVE_MS, 마지막이면 remaining`을 계산해 `allowed < MIN_REMAINING_MS`면 건너뛰고, 아니면 `AbortSignal.timeout(allowed)`를 넘긴다. 체인 설명 주석 갱신, 몫 때문에 건너뛸 때의 로그 주석 |
| `worker/ai/workersAiText.ts`, `worker/ai/claude.ts`, `worker/ai/types.ts`, `shared/api.ts` | 주석만: "남은 예산" → "체인이 배분한 시간(뒤 제공자가 있으면 그 몫을 뺀 값)", 바뀐 동작 설명(1차 리뷰 #1) |
| `worker/ai/claude.test.ts` | 신호가 끊긴 뒤 SDK 중단 오류를 "time budget exceeded (retries included)"로 바꿔 던지는지(1차 리뷰 #3) |
| `worker/ai/textChain.test.ts` | 새 테스트 3건(아래) |
| `README.md` | 텍스트 제공자 절의 시간 예산 문장에 남겨 두는 몫과 운영 순서에서의 효과 |

## 추가한 테스트

| 테스트 | 확인하는 것 |
| --- | --- |
| 뒤 제공자 몫을 남기고 마지막은 전부 | 첫 제공자가 바로 실패하면 신호 시간이 차례로 `[25000 − 12000]`, `[25000]` |
| 느린 실패 뒤에도 예비 모델 응답 | 첫 제공자가 받은 13초를 다 쓰고 실패(시계 주입)해도 둘째가 `AbortSignal.timeout(12000)`으로 시도되어 `provider: "workers-ai"`, error 로그 없음 |
| 상수 관계 | `25000 − 12000 ≥ 3000`(첫 제공자를 처음부터 건너뛰지 않음), `12000 ≥ 3000` |

기존 예산 테스트 2건(뒤 Workers AI가 남은 예산만큼 신호를 받음, 앞이 예산을 다 쓰면 건너뜀)은 마지막 제공자 규칙과 기존 건너뛰기 규칙 그대로라 수정 없이 통과한다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` | 종료 코드 0 |
| `npm run lint` | 종료 코드 0 |
| `npm test` | 종료 코드 0, 36 파일 278 테스트. 1차 리뷰 반영 뒤 main(023 포함)에 다시 얹어 36 파일 282 테스트 |
| `npm run build` | 종료 코드 0 |

실제 Claude 장애는 만들 수 없어 시계를 주입한 단위 테스트로 확인했다. 정상 경로는 Claude 실측 2.0~3.6초라 13초 상한에 닿지 않는다.

## 알려진 한계

- Claude SDK 재시도(1회)는 13초 안에서만 된다. 첫 요청이 12초 타임아웃이면 재시도는 약 0.5초만 남아 사실상 Llama로 넘어간다. 의도한 동작이다.
- Workers AI가 마지막일 때 남은 시간(약 12초)을 다 쓰면 서버 합계는 여전히 25초 안이다. 클라이언트 30초 규칙(`shared/api.ts`)은 그대로 지켜진다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 남겨 둘 몫 10초 | 12초 | 1차 리뷰 #2: Llama 실측 최댓값 9.4초 기준 여유가 0.6초뿐. 12초면 2.6초 여유, Claude는 13초로 요청 12초 한 번이 그대로 들어간다 |
| 제공자 코드 변경 없음 | 주석만 4곳 수정 | 1차 리뷰 #1: "남은 예산을 신호로 받는다"는 설명이 배분 규칙 뒤로 틀린 설명이 되었다 |
| — | main(023 병합)에 다시 얹음(rebase) | 023이 `shared/api.ts`를 바꿔, 같은 파일 주석 수정이 병합 때 겹치지 않게 |

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
