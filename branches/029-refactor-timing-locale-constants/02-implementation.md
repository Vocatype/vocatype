# 029 refactor/timing-locale-constants — 구현 문서

## 요약

020 후속 후보 두 가지를 처리했다. 축 계산의 기본 언어는 따로 적은 `'en'` 대신 `DEFAULT_LOCALE`을 쓴다. Claude SDK 상수(`REQUEST_TIMEOUT_MS` 12초, `MAX_RETRIES` 1회)를 내보내, 리딩 체인 예산과의 관계 두 가지를 테스트로 고정했다. 값은 하나도 바꾸지 않았다.

- 예산 전부를 받을 때: 12초 × 2 + 재시도 대기 0.5초 = 24.5초 ≤ 25초
- 뒤에 제공자가 있을 때: 12초 ≤ 25 − 12(`FALLBACK_RESERVE_MS`) = 13초

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/features/analysis/axes.ts` | `DEFAULT_LOCALE`을 가져와 `options.locale ?? DEFAULT_LOCALE`. `AxisOptions.locale` 주석에 "없으면 DEFAULT_LOCALE" |
| `src/features/analysis/axes.test.ts` | "언어를 주지 않으면 앱 기본 언어(DEFAULT_LOCALE)의 조음 속도 범위를 쓴다" |
| `worker/ai/claude.ts` | `REQUEST_TIMEOUT_MS`·`MAX_RETRIES` 내보냄. 주석에 두 관계와 검사하는 테스트 |
| `worker/ai/claude.test.ts` | `maxDefaultRetryDelaysMs`(SDK 0.135.0 기본 재시도 대기 최댓값 합), `describe('Claude 시간 상수와 리딩 체인 예산')` 테스트 2개 |
| `worker/ai/textChain.ts` | `FALLBACK_RESERVE_MS` 주석의 "요청 12초 한 번은 그대로 들어간다" 뒤에 "(claude.test.ts 가 검사한다)" |

## 설계 대비 달라진 점

없음. 새 테스트는 설계대로 `claude.test.ts`에 두었고, 기존 테스트(`shared/api.test.ts` 리딩 시간 규칙, `textChain.test.ts` 예산 배분 상수, `claude.test.ts` 신호 없을 때 상한)는 고치지 않았다.

## 회귀를 잡는지(일부러 바꾼 뒤 되돌림)

| 바꾼 것 | 계산 | 실패한 테스트 |
| --- | --- | --- |
| `MAX_RETRIES` 1 → 2 | 12 × 3 + (0.5 + 1) = 37.5 > 25초 | 예산 전부 관계 |
| `REQUEST_TIMEOUT_MS` 12,000 → 13,000 | 13 × 2 + 0.5 = 26.5 > 25초. 몫 관계는 13 ≤ 13초라 통과 | 예산 전부 관계 |
| `REQUEST_TIMEOUT_MS` 12,000 → 13,500 | 27.5 > 25초, 13.5 > 13초 | 둘 다 |
| `FALLBACK_RESERVE_MS` 12,000 → 14,000 | 12 > 25 − 14 = 11초 | 몫 관계 |
| `axes.ts` 기본값 `'ko'` | 기본 언어와 다른 범위 | 새 기본 언어 테스트, 기존 "속도·밀도·변화 축이 글자에 반영된다"(언어 없이 영어 범위를 전제로 한 테스트) |

처음 확인 때 실수가 있었다. 바꾼 파일을 `git checkout`으로 되돌리는 스크립트가 아직 커밋하지 않은 소스 수정까지 되돌려, 두 번째 변경부터는 029 수정이 빠진 코드에서 돌아 결과가 무효였다. 수정을 다시 적용해 커밋(`f5f2200`)한 뒤 다시 확인했고, 위 표가 그 결과다.

## 빌드 결과 비교

main(`e417d49`과 같은 코드) 빌드와 이 브랜치 빌드를 비교했다.

| 대상 | 결과 |
| --- | --- |
| 클라이언트(`dist/client/assets`) | 파일 이름까지 같다(`index-DijGa0wH.js`, `index-CpSgsQrj.css`). 번들러가 `DEFAULT_LOCALE`(`'en'`)을 그대로 풀어 넣어 내용이 같다 |
| Worker(`dist/worker/index.js`) | `timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES`가 `timeout: 12e3, maxRetries: 1`로 인라인되고 상수 선언과 주석이 바뀐 것뿐. 같은 값이라 동작이 같다 |

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` / `lint` / `build` | 종료 코드 0 |
| `npm test` | 종료 코드 0, 37 파일 299 테스트(296 + 3) |

## 알려진 한계

- 재시도 대기 값(첫 대기 0.5초, 최대 8초, 0.75~1배)은 SDK 내부 값이라 테스트 안에 옮겨 적었다. SDK를 올리면서 이 값이 바뀌어도 테스트는 모른다. 버전(0.135.0)을 주석에 적어 두었다
- 서버가 `retry-after`(또는 `retry-after-ms`)를 주면 SDK는 0 < 값 ≤ 2³¹−1ms이면 그 값을 그대로 기다린다(0.135.0 `client.mjs`, 그 밖에는 기본 대기). 그 경우는 이 관계로 막지 않으며, 지금처럼 중단 신호가 상한이다

## 배포 후 확인

사용자 승인(상위 세션 전달)에 따라 2026-10-22 16:56:45 KST에 main(`7b6fc27`)을 푸시했다. Cloudflare Workers Builds가 자동 배포했다: GitHub 커밋 검사 "Workers Builds: vocatype — completed/success"(07:57:20Z), 배포 기록 07:57:15Z, 버전 `41b95935-1650-4982-87de-d495567097a1`.

16:57:25 KST, `https://vocatype.hs827.workers.dev`:

| 확인 | 결과 |
| --- | --- |
| `GET /`, `GET /api/health` | 200, 200 |
| `GET /api/config` | `textProviders: ["claude","workers-ai"]`, 초상·해설 켜짐 |
| 배포된 클라이언트 번들 | `index-DijGa0wH.js`, `index-CpSgsQrj.css`로 배포 전과 같다. 빌드 비교(위)대로 클라이언트 결과물이 바이트까지 같아 기대한 결과다 |
| Worker | 바뀐 것은 같은 값의 상수 인라인과 주석뿐이라 밖에서 보이는 동작 차이가 없다. 새 버전이 100% 배포된 것만 확인했다 |

- AI 호출(초상·해설)은 하지 않았다. Claude 시간 관계는 단위 테스트로만 확인한다.
