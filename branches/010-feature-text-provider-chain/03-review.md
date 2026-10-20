# 010 feature/text-provider-chain — 리뷰 문서

리뷰 대상: `feature/010-text-provider-chain` → `main` 전체 diff(`b95f562..6963832`).
리뷰 방식: 009를 리뷰한 것과 같은 별도 리뷰 에이전트가 설계·구현 문서와 diff, 생성 타입(`worker-configuration.d.ts`의 Llama 3.3 70B 입력·JSON 모드)과 Cloudflare 문서(Workers AI 가격표, JSON 모드)를 읽고 typecheck / lint / test / build를 다시 실행했으며, 개발 서버에 `curl`로 `/api/config`와 400/403/405/413을 프로브했다(과금되는 `/api/reading` 실호출은 하지 않음). 구현자가 결과를 반영했다.

## 1차 리뷰

### 체크리스트

| 항목 | 결과 |
| --- | --- |
| 설정 파싱·체인 엣지 | 빈 값·`mock`·모르는 값 → 빈 체인, 공백·`\r` 제거, 중복은 첫 것, 순서 보존, 키 공백 제외, 바인딩 없으면 workers-ai 제외, 모두 실패 시 warn n줄 + error 1줄. 로그에 입력·키 없음(테스트가 단언). 체인 전체 시간 예산 없음(1) |
| Workers AI 입력·출력 | 생성 타입 `…_Messages`·`JSON_Mode`와 일치, 모델은 JSON 모드 지원 목록에 있음, 문서 예시의 `response`는 객체·타입은 문자열 → 양쪽 처리 맞음. `max_tokens` 600은 한글에 여유 2배(3) |
| 계약 변경 | `textProvider` 잔존 없음, 클라이언트 `mock` → null 이 길이 검증 전에 적용, `GeneratingScreen`/`reading.ts`는 변경 불필요 |
| Claude 경로 | 거부·잘림 검사·25초 신호·usage 로그 유지, 공용 파서는 기존 로직 + 펜스 제거 + 배열 거부(오류 문자열만 변화) |
| README | 체인 설명·설정 표·`provider` 의미·503 조건 일치. 초상 뉴런 수치 과소(2) |
| 테스트 | 설정 표 모든 행, 성공 시 다음 미호출, 실패→다음, 형식 오류→다음, 전부 실패, 빈 체인, Workers AI 입력/응답/오류, 라우트 3건, 클라이언트 — 핵심 경로 덮임. 문자열 출력 케이스 없음(7) |
| typecheck / lint / test(171) / build | 모두 통과 |

### 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| 1 | minor | `textChain.ts`, `workersAiText.ts` | 체인 전체 시간 예산이 없다. Workers AI 호출(바인딩 옵션에 중단 신호 없음) 20초 + Claude 25초면 클라이언트 30초를 넘겨, 클라이언트가 포기한 뒤 유료 호출이 나간다(009 #3의 체인판) | 체인 전체 25초 예산: 시도 전 남은 예산이 3초 미만이면 건너뛰고 mock, 시도하는 제공자에는 남은 예산을 `AbortSignal`로 전달. `TextProvider.generateReading(input, { signal })`로 확장, Claude가 이 신호를 우선 사용. 테스트 2건 추가 |
| 2 | minor | `README.md`, `01-design.md` | 초상 1장 "수백 뉴런"은 과소. 가격표 기준 Lucid Origin 768²는 타일 2.25 × 636 + 스텝 × 12 ≈ 1,400~1,500뉴런(하루 6~7장이면 소진). 리딩 "약 70뉴런"은 맞음, 설계의 8B "약 45"는 약 22 | README 수치 수정. 설계 문서는 그대로 두고 02 문서에 정정 기록 |
| 3 | nit | `workersAiText.ts` | `max_tokens: 600`. 한글 3~4문장 JSON은 250~350토큰이라 잘리면 유료로 넘어감 | 1024 (실제 출력만 과금) |
| 4 | nit | `textChain.ts` | 이름 비교가 대소문자 구분, 모르는 값만 있으면 무음으로 빈 체인 | 소문자 정규화. 경고 로그는 요청마다 찍혀 넣지 않고 `/api/config`로 확인하도록 문서화 |
| 5 | nit | `wrangler.jsonc` | AI 바인딩 주석이 낡음("mock 상태에서는 쓰지 않지만") | 초상·리딩 체인이 함께 쓰고 무료 할당량도 공용임을 명시 |
| 6 | nit | `types.ts`, `textChain.ts` | `TextProvider.supportsReading`이 체인에서 쓰이지 않는 죽은 필드 | 제거. `TextChain.supportsReading`은 라우트가 쓰므로 유지 |
| 7 | nit | 테스트, 문서 | 라우트 503 안전망은 어떤 테스트도 타지 않음(체인이 던지지 않음), 출력 `string` 변형 테스트 없음, 02 문서 미커밋 | 문자열 출력 케이스 추가(`empty response`). 503 안전망은 의도적으로 도달 불가에 가까워 그대로 둠. 문서는 병합 전 커밋 |

### 1차 결론

**병합 가능**(차단 항목 없음). 1~7 반영.

### 1차 반영 후 구현자 확인

- 반영 커밋: `fix(reading): 010 리뷰 반영 — …`
- typecheck / lint / test(27 파일 173) / build 통과
- 시간 예산은 단위 테스트(가짜 시계로 24초 경과 → 다음 제공자 건너뜀 → mock, 신호 전달)로 확인. 실제 체인 동작(4006 → Claude)은 반영 전 커밋에서 workerd로 확인했고(02 문서), 반영 분은 체인 내부 로직만 바꿨다.

## 최종

- 병합 조건 충족: 리뷰 "병합 가능", 권고 사항 반영, 폴백 경로 실증, 02·03 문서 커밋
- 병합: `git merge --no-ff feature/010-text-provider-chain` → main
- 브랜치 삭제: `git branch -d feature/010-text-provider-chain`
- 남은 확인(배포 후, README 절차): 무료 할당량이 초기화된 날 `provider: "workers-ai"` 응답의 한국어 품질. 운영 체인에 Claude를 넣으려면 `wrangler secret put ANTHROPIC_API_KEY` 뒤 `TEXT_PROVIDER`를 `"workers-ai,claude"`로.
