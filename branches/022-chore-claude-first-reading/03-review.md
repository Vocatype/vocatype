# 022 chore/claude-first-reading — 리뷰 문서

## 1차

- 검토자: 독립 리뷰 에이전트(구현과 분리된 새 컨텍스트)
- 대상: `main...HEAD` = `9676174`(설계), `62b3654`(설정·타입·README·테스트), `39f909b`(구현 문서). merge-base `2527e47`
- 검토 중 main이 019 병합으로 앞서 갔지만 `git merge-tree --write-tree`로 main·`refactor/020-contract-cleanup` 모두 충돌 없음을 확인했다

### 체크리스트

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| `TEXT_PROVIDER` 값과 설정 주석 | 통과 | `wrangler.jsonc:14-24` |
| `worker-configuration.d.ts`가 깨끗한 `wrangler types` 출력 | 통과. 스크래치 경로로 다시 생성해 비교하면 본문이 같고 `mainModule` 상대 경로만 다르다. 비밀 이름 없음 | `worker-configuration.d.ts:9` |
| 파싱 순서와 키 조건 | 통과 | `worker/ai/textChain.ts:27-33, 44-51` |
| 예산 25초, 최소 남은 시간 3초, 신호 전달 | 통과 | `textChain.ts:74-76, 107-114`, `claude.ts:15-16, 73, 78-85` |
| 401을 SDK가 재시도하지 않는지 | 통과. apiKey를 쓰면 토큰 캐시가 없어 401 재시도 분기에 들어가지 않고, 4xx는 재시도하지 않는다 | `@anthropic-ai/sdk` `client.js:190, 805-834` |
| 429·529 처리 | 통과. 재시도하며 `retry-after`를 기다리고, 기다리는 중 신호가 끊기면 `APIUserAbortError` → `claude.ts`가 "time budget exceeded"로 바꾼다 | `client.js:828-864, 589`, `sleep.js:12-14`, `claude.ts:84` |
| 타임아웃 2회의 시간 계산 | 통과. 12초 + 백오프 약 0.4초 + 12초 ≈ 24.4초라 workers-ai를 건너뛴다 | `client.js:866-874` |
| 새 테스트가 주장을 증명하는지 | 통과. 두 단언 모두 순서에 의존한다(순서를 뒤집으면 fetch 0회 또는 `run` 호출로 실패) | `worker/index.test.ts:247-249, 265` |
| 결정성·속도·전역 누수 | 통과. 4ms·2ms, 3회 반복 통과, `afterEach`에서 전역·목 복원 | `worker/index.test.ts:34-37` |
| 클라이언트 변경 필요 여부 | 통과. 클라이언트는 제공자 이름으로 분기하지 않는다 | `src/features/ai/client.ts` |
| 개인정보 절 | 통과 | `README.md:78-79, 152` |
| README 체인 순서 일관성 | **실패**(#1) | `README.md:4` |
| 비용 수치 일관성 | 부분 통과(#2) | `README.md:156` |
| 009·010·011 근거 | 통과, 출처 표기 한 곳 오류(#7) | 009 02:85, 010 02:57, 011 02:69, 011 01:58 |

### 발견 사항과 조치

| 번호 | 심각도 | 내용 | 조치 |
| --- | --- | --- | --- |
| 1 | 중간 | README 첫 소개 문단이 "무료 Workers AI 텍스트 모델 → Claude API 순서"로 남아 운영 순서와 정반대. 02 문서의 README 변경 목록에도 빠짐 | 수정: "Claude API → 무료 Workers AI 텍스트 모델 순서"(`README.md:4`). 02 변경 목록에 추가 |
| 2 | 낮음 | 출력 토큰이 "약 160~200"인데 같은 문단의 "$1.44~1.8"은 264토큰 기준 | 수정: "약 160~264토큰(009·010 실측)" |
| 3 | 낮음 | "출력 잘림"을 빠른 실패로 분류했지만 4096토큰에 12초 안에 닿기 어려워 보통 타임아웃(느린 실패)으로 나타남 | 수정: 01 표에서 느린 실패 쪽으로 옮기고 이유를 적음. 타임아웃 2회 합계도 24.4초로 정밀화 |
| 4 | 낮음 | workers-ai가 둘째일 때 신호를 받지 않아 서버 합계가 약 31초로 클라이언트 30초를 넘을 수 있음(무료 호출, 유료 호출 규칙은 지켜짐) | 수정: 01 "시간 예산과 폴백의 한계", 02 "알려진 한계"에 추가하고 020 의존을 명시 |
| 5 | 낮음 | 020이 `shared/api.ts`에 추가한 "다음 제공자(유료 Claude)" 주석이 두 브랜치 병합 뒤 낡게 됨 | 기록: 02 "알려진 한계"에 적고, 나중에 병합되는 쪽이 고친다. 020 세션에 알림 |
| 6 | 낮음 | README 3단계가 한 순서의 기대값만 적고, 4단계 로컬 예시에 Anthropic 과금 안내 없음 | 수정: 3단계에 두 순서의 기대값, 4단계에 로컬 과금과 과금 없이 보는 방법(`TEXT_PROVIDER=workers-ai`) |
| 7 | 낮음 | "(011 계산)"은 $1.44만 맞고, "최악"은 IP 하나 기준이라 전체 상한이 아님 | 수정: 01·README를 "IP당 최대"로 바꾸고 "전체 상한은 Anthropic 콘솔의 지출 한도뿐"을 명시 |
| 8 | 낮음 | 표의 "011~021"은 아직 병합되지 않은 번호를 포함한 추측 | 수정: "011부터 022 전까지" |
| 9 | 낮음(선택) | 운영 설정을 고정하는 테스트가 없음 | 반영: `PRODUCTION_TEXT_PROVIDER = 'claude,workers-ai' satisfies Env['TEXT_PROVIDER']`. 생성 타입을 옛 값으로 바꾸면 `tsc -b`가 TS1360으로 실패하는 것을 확인 |
| 10 | 낮음(선택) | `textChain.ts:8`, `workersAiText.ts:42` 주석·예시, `README.md:58`이 옛 순서 기준 | `README.md:58`(프로젝트 구조 설명)은 수정. 코드 주석 두 곳은 020과 겹쳐 020 병합 뒤 정리(02 "알려진 한계") |

### 검토자가 직접 실행한 검사

| 명령 | 결과 |
| --- | --- |
| `npm test` | 종료 코드 0, 29 파일 195 테스트 |
| `npm run typecheck` | 종료 코드 0 |
| `npm run lint` | 종료 코드 0 |
| `npx vitest run worker/index.test.ts -t "운영 순서"` 3회 | 매번 2건 통과 |
| `npx wrangler types <scratch>` | 종료 코드 0, 본문 동일 |
| `git merge-tree --write-tree HEAD main` / `HEAD refactor/020-contract-cleanup` | 충돌 없음 |

배포·푸시·운영 주소 호출은 하지 않았다.

### 1차 결론

**수정 필요.** #1(중간)과 문서 사실 오류(#2, #7) 때문. 코드·설정·생성 타입·테스트에는 결함이 없었다.

### 1차 반영 뒤 구현자 검사

| 명령 | 결과 |
| --- | --- |
| `npm run typecheck` | 종료 코드 0 |
| `npm run lint` | 종료 코드 0 |
| `npm test` | 종료 코드 0, 29 파일 195 테스트 |
| 생성 타입 리터럴을 옛 값으로 바꾼 `npx tsc -b`(묶임 확인) | 종료 코드 1, TS1360. 파일은 즉시 복원 |
