# 024 fix/reading-fallback-reserve — 구현 문서

## 요약

리딩 체인이 뒤에 시도할 제공자 몫으로 10초(`FALLBACK_RESERVE_MS`)를 남기고, 앞 제공자에게는 남은 예산에서 그 몫을 뺀 시간만 중단 신호로 준다. 마지막 제공자는 남은 예산을 다 쓴다. 운영 순서(`claude,workers-ai`)에서는 Claude가 최대 15초, Llama가 최소 10초를 갖는다. Claude가 느리게 실패해도(멈춤·타임아웃 두 번·긴 `retry-after`) 15초에서 끊기고 Llama가 답할 수 있다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `worker/ai/textChain.ts` | `FALLBACK_RESERVE_MS = 10_000` 추가, `MIN_REMAINING_MS` 내보냄(테스트용). 반복문이 `providers.entries()`로 위치를 보고 `allowed = 마지막이 아니면 remaining − FALLBACK_RESERVE_MS, 마지막이면 remaining`을 계산해 `allowed < MIN_REMAINING_MS`면 건너뛰고, 아니면 `AbortSignal.timeout(allowed)`를 넘긴다. 체인 설명 주석 갱신 |
| `worker/ai/textChain.test.ts` | 새 테스트 3건(아래) |
| `README.md` | 텍스트 제공자 절의 시간 예산 문장에 남겨 두는 몫과 운영 순서에서의 효과 |

## 추가한 테스트

| 테스트 | 확인하는 것 |
| --- | --- |
| 뒤 제공자 몫을 남기고 마지막은 전부 | 첫 제공자가 바로 실패하면 신호 시간이 차례로 `[25000 − 10000]`, `[25000]` |
| 느린 실패 뒤에도 예비 모델 응답 | 첫 제공자가 받은 15초를 다 쓰고 실패(시계 주입)해도 둘째가 `AbortSignal.timeout(10000)`으로 시도되어 `provider: "workers-ai"`, error 로그 없음 |
| 상수 관계 | `25000 − 10000 ≥ 3000`(첫 제공자를 처음부터 건너뛰지 않음), `10000 ≥ 3000` |

기존 예산 테스트 2건(뒤 Workers AI가 남은 예산만큼 신호를 받음, 앞이 예산을 다 쓰면 건너뜀)은 마지막 제공자 규칙과 기존 건너뛰기 규칙 그대로라 수정 없이 통과한다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` | 종료 코드 0 |
| `npm run lint` | 종료 코드 0 |
| `npm test` | 종료 코드 0, 36 파일 278 테스트 |
| `npm run build` | 종료 코드 0 |

실제 Claude 장애는 만들 수 없어 시계를 주입한 단위 테스트로 확인했다. 정상 경로는 Claude 실측 2~4초라 15초 상한에 닿지 않는다.

## 알려진 한계

- Claude SDK 재시도(1회)는 15초 안에서만 된다. 첫 요청이 12초 타임아웃이면 재시도는 약 3초만 남아 사실상 Llama로 넘어간다. 의도한 동작이다.
- Workers AI가 마지막일 때 남은 시간(최소 10초)을 다 쓰면 서버 합계는 여전히 25초 안이다. 클라이언트 30초 규칙(`shared/api.ts`)은 그대로 지켜진다.
