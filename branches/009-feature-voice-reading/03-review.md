# 009 feature/voice-reading — 리뷰 문서

리뷰 대상: `feature/009-voice-reading` → `main` 전체 diff.
리뷰 방식: 구현과 무관한 별도 리뷰 에이전트가 설계·구현 문서와 diff, 설치된 SDK 타입(`@anthropic-ai/sdk` 0.135)을 읽고 typecheck / lint / test / build를 다시 실행했으며, 개발 서버에 `curl`로 라우트·상태 코드·본문 제한·속도 제한 분리를 프로브했다. 실제 Anthropic 호출은 하지 않았다(키 없음). 구현자가 결과를 반영했다.

## 1차 리뷰

대상 커밋: `5645318` (feat).

### 체크리스트

| 항목 | 결과 |
| --- | --- |
| 라우트·검증·어댑터 정확성 | 차단 결함 없음. 캡션 상한과 카드 폭 불일치(1), `max_tokens` 여유(2), 재시도 대기 상한(3) |
| 보안·남용 | 추가 발견 없음. 클라이언트가 프롬프트에 넣을 수 있는 것은 16개 코드·0..1 수치·ko/en뿐, 모델 값은 정규식, 오류 응답 고정, 로그에 키 없음 |
| 개인정보 | Worker로 타입 코드·여섯 축·언어만, Anthropic으로 프롬프트만, `metadata` 없음. README에 Anthropic 데이터 정책 문장 부재(12) |
| Workers 호환 | SDK 지연 청크에 `node:` import 존재, workerd에서 Claude 경로 미실행(4) |
| 테스트 | 핵심 경로 덮임. 언어 규칙·요청 계획이 컴포넌트 안에 있어 단위 테스트 없음(11) |
| UX·i18n·a11y | 단계 문구 고정(7), 저신호 녹음에도 요청(8), 한글 이탤릭(9) |
| 프롬프트 품질·편향 | 구조·해요체·캡션 규칙 적절. 성별·나이 코드 어휘 미차단, 축 이름 금지가 자연어까지 막을 수 있음, 한국어 2인칭 지침 없음(6) |
| typecheck / lint / test(153) / build | 모두 통과 |

### 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| 1 | minor | `readingPrompt.ts` ↔ `renderCard.ts` | 프롬프트의 캡션 상한(ko 40/en 80자)이 저장 카드 한 줄 폭(27px, 876px → 한글 약 32자·영문 약 65자)보다 커서 지시대로 쓰면 PNG에서 늘 "…"로 잘림 | 상한을 ko 28/en 60자로 내리고 프롬프트에 "이미지 한 줄에 인쇄된다"를 명시. 캡션 글꼴 26px. 테스트에 상한 문구 단언 |
| 2 | minor | `claude.ts` | `max_tokens: 1024`. 적응형 사고 토큰이 포함돼 잘리면 503 → 조용한 폴백 | 4096으로. 실제 호출 확인 때 `usage.output_tokens` 기록 |
| 3 | minor | `claude.ts` | SDK가 `retry-after`를 그대로 기다려(최대 수십 초) 클라이언트가 30초에 포기한 뒤에도 Worker가 두 번째 호출을 보낼 수 있음 | `messages.create(params, { signal: AbortSignal.timeout(25_000) })`. `CreateMessage`에 옵션 인자 추가, 테스트에서 신호 전달 단언 |
| 4 | minor | 번들, `wrangler.jsonc` | SDK 지연 청크의 `node:fs`·`node:crypto` import. workerd에서 Claude 경로가 실행된 적 없음 | 빌드 출력으로 `wrangler dev` + 가짜 키 실행: 번들 로드 정상, SDK가 Anthropic 호출 → 401 → 503(아래 "1차 반영 후 구현자 확인"). `nodejs_compat` 불필요. 실제 키 호출은 별도 확인 |
| 5 | minor | `claude.ts`, README | `isTextModel`은 `claude-*`를 모두 통과시키지만 `effort`는 4.5 이하에서 400 → 전면 503 | README에 "effort 지원 모델(4.6 이상, 5.x)만, 이전 세대는 조용히 실패" 명시. 정규식은 미래 모델 이름을 막지 않도록 그대로 둠 |
| 6 | minor | `readingPrompt.ts` | 성별·나이 코드 어휘 미차단, `pitch`가 성별 대리 변수, "축 이름 금지"가 과도, 한국어 2인칭 지침 없음 | 규칙 추가: 성별·나이가 실린 단어 금지(영·한 예시), "음높이·온기는 그 사람이 누구인지 말해 주지 않는다", 수치·축 이름·코드를 "그대로" 말하지 말되 성질 묘사는 허용, 한국어는 주어 생략 또는 "목소리" 주어. `pitch` 행은 유지(목소리 묘사에 유효하며 금지 규칙으로 통제) |
| 7 | minor | `GeneratingScreen.tsx` | 초상·리딩 둘 다 켜지면 초상이 먼저 끝나도 문구가 "초상을 그리는 중"에 고정 | 초상 프라미스 완료 시 리딩이 미완이면 "목소리를 읽는 중"으로 전환. 브라우저에서 순서 확인 |
| 8 | minor | `GeneratingScreen.tsx` | 저신호 녹음(축 전부 0.5)에도 리딩 요청 | `planGeneration`에서 `quality !== 'low-signal'`일 때만 요청. 테스트 추가 |
| 9 | nit | CSS, `renderCard.ts` | 한글 글꼴에 이탤릭이 없어 합성 기울임 | 화면·카드 모두 이탤릭 제거, 굵기·색으로만 구분 |
| 10 | nit | `worker-configuration.d.ts` | 로컬 `.dev.vars` 때문에 `AI_PROVIDER`가 `string`으로 넓어짐 | 리터럴 복원, 02 문서에 원인 기록 |
| 11 | nit | 테스트 | 언어 일치 규칙·요청 계획이 컴포넌트 안에만 있음 | `src/features/ai/reading.ts`로 순수 함수 추출(`planGeneration`, `visibleReading`) + 테스트 3건 |
| 12 | nit | README | Anthropic 데이터 정책 언급 없음, ko 요청엔 한국어 타입 이름도 들어감 | 두 가지 모두 문장 추가 |
| 13 | nit | 문서 | 02 문서 미커밋 | 실제 호출 확인 뒤 커밋 |

### 1차 결론

**병합 가능**(차단 항목 없음). 권고 1~12를 모두 반영하고 13은 실제 호출 확인 뒤 처리한다.

### 1차 반영 후 구현자 확인

- 반영 커밋: `fix(reading): 1차 리뷰 반영 — …`
- typecheck / lint / test(26 파일 156) / build 통과
- workerd 실행(4): `wrangler dev -c dist/worker/wrangler.json --port 8788 --var TEXT_PROVIDER:claude --var ANTHROPIC_API_KEY:<가짜>` → `/api/config` `textProvider: "claude"`; `POST /api/reading` → Anthropic 401 → 503(396ms), 로그에 `[reading] provider failed: Error: 401 …`, 모듈 오류 없음
- 브라우저(7): 초상 0.4초 뒤 503·리딩 3초 뒤 응답 가로채기에서 단계 문구 "초상을 그리는 중 (조금 걸려요)" → "목소리를 읽는 중", 결과에 리딩 카드

## 2차 리뷰

대상: 커밋 `98836ad`(1차 반영), 비교 `5645318..HEAD`. 같은 리뷰 에이전트가 검증 4종을 다시 실행하고 SDK 소스(`sleep`·`makeRequest`의 abort 처리)를 읽어 전체 타임아웃 신호의 동작을 확인했으며, 개발 서버 HMR 뒤 `/api/config`·`/api/reading`을 다시 프로브했다.

### 1차 항목 해결 여부

1~3, 5~12 해결 확인. 특히 #3은 SDK가 `sleep(ms, signal)`에서 abort 시 깨어나고 다음 `makeRequest`가 `APIUserAbortError`를 던지며 재시도하지 않음을 소스로 확인(최악: 429 + `retry-after: 20` → 25초에 503, 두 번째 호출 없음). #4는 가짜 키 workerd 실행으로 번들 로드·클라이언트 생성·신호 배선·fetch 1회까지 검증됐고, 실제 키 ko/en 1회는 운영 전환 전 조건으로 남김. #13은 병합 전 문서 커밋으로 처리.

### 신규 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| N1 | nit | `GeneratingScreen.tsx` | 초상이 꺼져 있으면 `portraitPromise`가 즉시 완료돼 이미 `reading`인 단계를 같은 값으로 한 번 더 설정(중복 렌더 1회) | `plan.wantPortrait && plan.wantReading` 조건 추가 |
| N2 | nit | `claude.ts`, `index.ts` 로그 | 전체 25초 상한에 걸리면 `APIUserAbortError: Request was aborted.`로만 남아 느려서 끊긴 것인지 구별 불가 | `signal.aborted`면 `total timeout 25000ms exceeded (retries included)`로 감싸 던짐 |
| N3 | nit | `AbortSignal.timeout` | Node 18+/vitest·workerd 모두 지원, 타이머 누수 없음 | 확인만, 조치 없음 |

보안·개인정보·라우트·캔버스 예산 차원에서 2차 변경으로 인한 새 문제 없음.

### 2차 결론

**병합 가능.** N1·N2 반영. 조건: 02·03 문서 커밋, 운영에서 `TEXT_PROVIDER=claude`로 켜기 전 실제 키 호출 1회(ko/en) 기록.

### 2차 반영 후 구현자 확인

- 반영 커밋: `fix(reading): 2차 리뷰 반영 — …`
- typecheck / lint / test(156) 통과
- 실제 키로 `TEXT_PROVIDER=claude` 로컬 호출 ko/en 각 1회 + 브라우저 전체 흐름 확인(02 문서 "실제 호출 확인"). 1차 #2의 권고대로 `usage.output_tokens`를 기록하기 위해 성공 시 토큰 수만 남기는 `console.info` 한 줄을 추가했다(사용자 데이터 없음, 운영은 observability 꺼짐). 실측 출력 160~200토큰이라 `max_tokens: 4096`은 충분하다. 1차 #4 잔여 항목(workerd에서 200 파싱 경로) 해소.

## 최종

- 병합 조건 충족: 1·2차 리뷰 "병합 가능", 권고 사항 모두 반영, 실제 호출 확인 완료, 02·03 문서 커밋
- 병합: `git merge --no-ff feature/009-voice-reading` → main
- 브랜치 삭제: `git branch -d feature/009-voice-reading`
- 운영에서 켜려면(별도 작업): `npx wrangler secret put ANTHROPIC_API_KEY` 뒤 `wrangler.jsonc`의 `vars.TEXT_PROVIDER`를 `"claude"`로 바꿔 푸시(README "Claude 켜기")
