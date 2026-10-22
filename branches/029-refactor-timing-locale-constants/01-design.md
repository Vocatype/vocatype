# 029 refactor/timing-locale-constants — 설계 문서

## 배경

020(계약 정리) 1차 리뷰가 낸 후속 후보 두 가지(`branches/020-refactor-contract-cleanup/02-implementation.md` "후속 후보")를 처리한다.

1. `src/features/analysis/axes.ts:70`의 `options.locale ?? 'en'`은 앱의 기본 언어 상수(`DEFAULT_LOCALE`, `src/i18n/locales.ts`)와 따로 적힌 같은 값이다. 기본 언어를 바꾸면 이곳만 남는다.
2. `worker/ai/claude.ts`의 SDK 설정(요청 1회 `REQUEST_TIMEOUT_MS` 12초, 재시도 `MAX_RETRIES` 1회)과 리딩 체인 예산(`READING_CHAIN_BUDGET_MS` 25초)의 관계("12초 × 2 ≤ 체인 예산")는 주석으로만 있다. 상수가 모듈 밖으로 나가지 않아 테스트가 볼 수 없다.

그 뒤 024(리딩 폴백 몫)에서 `FALLBACK_RESERVE_MS`(12초, `worker/ai/textChain.ts`)가 생겨, 뒤에 제공자가 있으면 앞 제공자는 25 − 12 = 13초만 받는다. 024 문서와 `textChain.ts` 주석은 "운영 순서(claude,workers-ai)에서 Claude는 13초를 받아 SDK 요청 12초 한 번이 그대로 들어간다"고 하지만, 이 관계도 테스트가 없다.

## 범위

### 포함

1. `axes.ts`: `options.locale ?? DEFAULT_LOCALE`. `AxisOptions.locale` 주석에 "없으면 `DEFAULT_LOCALE`"
2. `claude.ts`: `REQUEST_TIMEOUT_MS`·`MAX_RETRIES`를 내보낸다. 주석에 두 관계와 검사하는 테스트를 적는다
3. 테스트
   - `axes.test.ts`: 언어를 주지 않으면 `DEFAULT_LOCALE`의 조음 속도 범위를 쓴다
   - `claude.test.ts`: 상수 관계 두 가지(아래)
4. `textChain.ts`의 `FALLBACK_RESERVE_MS` 주석에 "Claude 요청 한 번이 들어간다"를 `claude.test.ts`가 검사한다고 한 줄

### 제외

- 값 변경(12초, 1회, 25초, 12초 모두 그대로). 관계를 테스트로 고정할 뿐이다
- 020 후속 후보의 나머지(초상 서버 상한은 023에서 처리, 화면의 언어별 분기, `ja-JP` 예시)

## 상수 관계 테스트

| 관계 | 식(지금 값) | 뜻 |
| --- | --- | --- |
| 예산 전부를 받을 때 모든 시도가 들어간다 | `REQUEST_TIMEOUT_MS × (1 + MAX_RETRIES) + 재시도 대기 최댓값 ≤ READING_CHAIN_BUDGET_MS` (12 × 2 + 0.5 = 24.5 ≤ 25초) | 체인 밖(신호 없이 부르면 체인 예산 전체를 자체 상한으로 건다)이거나 체인의 마지막 제공자일 때. SDK 설정이 예산보다 많은 시도를 약속하지 않는다. 020의 "12초 × 2 ≤ 체인 예산" |
| 뒤 제공자가 있을 때 요청 한 번이 들어간다 | `REQUEST_TIMEOUT_MS ≤ READING_CHAIN_BUDGET_MS − FALLBACK_RESERVE_MS` (12 ≤ 13초) | 운영 순서 `claude,workers-ai`에서 Claude가 받는 몫. 12초 요청이 몫보다 길면 Claude는 정상 요청도 끝까지 기다리지 못하고 신호로 끊긴다. 024의 주장 |

재시도 대기: SDK(`@anthropic-ai/sdk` 0.135.0, `client.mjs`의 `calculateDefaultRetryTimeoutMillis`)는 n번째(0부터) 재시도 전에 `min(0.5초 × 2^n, 8초)`에 0.75~1을 곱한 만큼 기다린다. 최댓값의 합을 테스트 안의 작은 함수로 계산한다(재시도 1회면 0.5초). 서버가 `retry-after`를 주면 그 값을 기다리는데, 그때의 상한은 지금처럼 중단 신호다(주석에 남긴다).

### 기존 테스트와 겹치지 않게

| 기존 테스트 | 보는 것 | 새 테스트와의 차이 |
| --- | --- | --- |
| `shared/api.test.ts` 리딩 시간 규칙 | 클라이언트 30초 > 체인 예산 25초 | 체인 바깥(클라이언트) 관계. Claude 상수는 보지 않는다 |
| `textChain.test.ts` 예산 배분 상수 | 25 − 12 ≥ 3초(첫 제공자를 처음부터 건너뛰지 않음), 12 ≥ 3초 | 제공자 종류와 상관없는 최소 시도 시간(`MIN_REMAINING_MS`). 새 테스트는 그 몫이 **Claude 요청 1회**를 담는지 본다 |
| `claude.test.ts` 신호가 없으면 체인 예산 전체를 상한으로 | `AbortSignal.timeout(25초)` 호출 | 동작(어떤 신호를 거는지). 새 테스트는 그 상한 안에 SDK 설정이 들어가는지(상수 관계) |

새 테스트는 `claude.test.ts`에 둔다. 두 관계 모두 Claude의 SDK 상수가 주어이고, 그 상수를 내보내는 모듈의 테스트다.

## 결정과 근거

| 결정 | 근거 |
| --- | --- |
| 재시도 대기를 관계식에 넣는다 | 020의 "12초 × 2"는 대기를 빼고 쓴 식이다. 지금은 여유 1초가 대기 0.5초를 담지만, 예산이나 요청 시간을 바꿀 때 대기를 잊으면 마지막 시도가 신호에 잘린다. SDK 내부 값이라 버전을 주석에 적는다 |
| 재시도 횟수를 늘리면 첫 관계가 깨지게 둔다 | `MAX_RETRIES = 2`면 12 × 3 + 1.5 = 37.5초 > 25초. 그런 변경은 예산이나 요청 시간도 함께 다시 정해야 하므로 테스트가 멈춰 세우는 것이 맞다 |
| `axes.ts`는 값 대신 상수를 가져온다 | `DEFAULT_LOCALE`이 바뀌면 화면 언어 기본값과 축 계산 기본값이 함께 바뀌어야 한다. 테스트는 상수를 따르는지만 본다(값 `'en'`을 다시 적지 않는다) |

## 검증 계획

1. typecheck / lint / test / build 종료 코드 0
2. 일부러 값을 바꿔 새 테스트가 실패하는지 확인한다(확인 뒤 되돌림): `MAX_RETRIES` 2, `REQUEST_TIMEOUT_MS` 13,000(첫 관계 26.5초 > 25초, 둘째 관계는 13 ≤ 13초로 통과)과 13,500(둘째 관계도 13.5 > 13초), `FALLBACK_RESERVE_MS` 14,000(둘째 관계 12 > 11초), `axes.ts`를 `'ko'`로
3. 동작 변경이 없다. 클라이언트 빌드 결과에서 바뀌는 것은 `axes.ts` 기본 언어를 가리키는 부분뿐이어야 하고(값은 같은 `'en'`), Worker는 주석·`export`만 바뀐다. 빌드 결과를 main 빌드와 비교한다
4. 독립 리뷰 → 병합 가능이면 `--no-ff` 병합, 푸시, 배포 후 확인(AI 호출 없이)
