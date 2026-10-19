# 006 feature/ai-adapter — 리뷰 문서

리뷰 대상: `feature/006-ai-adapter` → `main` 전체 diff.
리뷰 방식: Cloudflare Workers 경험이 있는 별도 리뷰 에이전트가 설계·구현 문서와 코드를 읽고 검증 명령을 실행했으며, 개발 서버에 `curl`로 라우트·상태 코드·본문 제한을 프로브하고 Cloudflare 모델 문서·wrangler 설정 스키마로 `seed`·`keep_vars`·`ratelimits`를 교차 확인. 구현자가 결과를 반영.

## 1차 리뷰

### 체크리스트

| 항목 | 결과 |
| --- | --- |
| Cloudflare 설정·배포 | 바인딩·출력 설정 정상. README의 대시보드 변수 안내는 **오동작 유도** (1) |
| Workers AI 호출 | 입력·출력 형태 일치. `seed` 지원 미검증 (2) |
| 남용·비용 | 속도 제한 없음 (3) |
| 요청 검증 | 1KB 제한이 바이트가 아님 (4) |
| 클라이언트·접근성 | indeterminate ARIA (5), data URL 검증 느슨 (6) |
| 개인정보 | 본문은 타입 코드·씨앗뿐, 음성 업로드 경로 없음, 로그 없음 — 문제 없음 |
| 테스트 | 라우트·타임아웃·취소 미검증 (8) |
| typecheck / lint / test / build | 모두 통과 |

### 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| 1 | major | `README.md` | 대시보드에서 변수를 바꾸라는 안내. `wrangler deploy`는 `keep_vars` 기본값(false)에서 대시보드 변수를 설정 파일 값으로 덮어쓰므로 다음 푸시에 `mock`으로 되돌아감 | 안내 삭제, "설정 파일을 바꿔 푸시"만 남기고 대시보드 변경이 되돌아가는 이유를 명시 |
| 2 | major | `workersAi.ts`, 문서 | `seed`는 모델 페이지 예제에만 나오고 파라미터 표에 없음. 무시되면 "같은 녹음 = 같은 얼굴"이 조용히 깨짐 | 문서를 "미확인"으로 정정, README 배포 후 확인 절차에 같은 요청 2회 비교 추가, 실패 시 모델 교체 검토 명시 |
| 3 | major | `worker/index.ts` | 인증·제한 없는 POST라 Workers AI 과금을 무한히 유발할 수 있고, 제3자 페이지에서도 호출 가능 | `ratelimits` 바인딩(IP당 1분 5회, 429 + `Retry-After`), `Sec-Fetch-Site` 교차 사이트 403. IP는 저장하지 않음을 README·개인정보 절에 명시 |
| 4 | minor | `worker/portrait.ts` | `text.length`는 UTF-16 코드 유닛이라 한글 600자(1838바이트)가 통과. 전체 버퍼링 후 검사 | 스트림을 바이트 단위로 누적해 초과 시 중단하는 `readBodyLimited`. 한글 본문 테스트 추가 |
| 5 | minor | `GeneratingScreen.tsx` | indeterminate 단계에 `aria-valuenow=90`, "90%" 거짓 정보 | `aria-valuenow` 생략, `aria-valuetext`는 단계 문구만 |
| 6 | minor | `client.ts` | `data:image/` 접두사만 검사해 SVG 통과, 길이 상한 없음 | JPEG/PNG/WebP base64 정규식, 4MB 상한. 테스트 추가 |
| 7 | minor | `README.md` | 로컬 실호출 절차에 `.dev.vars` 누락 | 추가 |
| 8 | minor | 테스트 | 라우트·타임아웃·외부 취소 미검증 | `worker/index.test.ts`(가짜 env, 405/403/429/503/HEAD), 클라이언트 취소·가짜 타이머 타임아웃 테스트 |
| n1 | nit | `workersAi.ts` | `FluxResult` 캐스트가 생성 타입과 중복 | 제거 |
| n2 | nit | `worker/index.ts` | 잘못된 메서드가 404, HEAD 미지원 | 405 + `Allow`, HEAD→GET |
| n3 | nit | `worker/index.ts` | `selectProvider`가 매 요청 실행 | 라우트 매칭 뒤로 이동 |
| n4 | nit | `client.ts` | `window.setTimeout` 때문에 테스트가 `window` 스텁 | `setTimeout` 전역 사용 |
| n5 | nit | `GeneratingScreen.tsx` | 설정 조회 대기(최대 5초) 동안 막대가 멈춤 | 분석과 동시에 조회 시작 |
| n6 | nit | `README.md` | "하루 수십 장" 근거 없는 비용 추정 | 삭제, 가격표 확인으로 |

### 1차 결론

**수정 필요.** 1~8과 n1~n6 모두 반영.

### 1차 반영 후 구현자 확인

- typecheck / lint / test(121) / build 통과. `wrangler types`로 `Env.PORTRAIT_LIMITER: RateLimit` 생성
- 개발 서버 `curl`: 교차 사이트 403, 같은 IP 6번째 요청 429, `HEAD /api/config` 200, `POST /api/config` 405

## 2차 리뷰

대상: 커밋 `08bb854`. 리뷰 에이전트가 검증 4종을 다시 실행하고 개발 서버 `curl`로 HEAD 200, `POST /api/config` 405(`Allow: GET, HEAD`), `GET /api/portrait` 405, `cross-site`/`same-site` 403, 한글 1838바이트 413, chunked 소형 본문 200, IP당 5회 뒤 429를 확인. 출력 `wrangler.json`에 `ratelimits` 포함 확인.

### 1차 항목 해결 여부

1~8, n1~n6 모두 해결 확인. `ratelimits` 정의가 스키마에 맞고 로컬 에뮬레이션에서 동작, `readBodyLimited`가 chunked·`NaN` content-length·본문 없음을 처리, `Request` 캐스트는 workerd 제네릭 불일치만 메움, `configPromise`는 reject하지 않아 unhandled rejection 없음.

### 신규 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 |
| --- | --- | --- | --- | --- |
| 1 | nit | `worker/index.ts` | `limiter.limit()`이 던지면 1101 오류 페이지 | try/catch로 fail-open |
| 2 | nit | `README.md` | "순간적으로만" 표현이 과함. 콜로별 제한이라 합산 한도는 더 큼 | "최대 60초 카운터 키, 영구 저장·로그 없음", 콜로별 제한 명시 |
| 3 | nit | `client.test.ts` | 테스트 이름이 실제 동작(취소된 신호로 fetch 호출)과 다름 | 이름 수정, 호출 1회·aborted 신호 단언 |
| 4 | nit | `README.md` | `md5`는 macOS 전용 | `shasum` |
| 5 | nit | — | `OPTIONS /api/portrait`가 운영에서 405. 동일 출처라 preflight 없음 | 기록만 |

### 2차 결론

**병합 가능.** 1~4 반영. `seed` 결정성은 배포 후 확인 항목으로 README에 유지.

## 최종

- 반영 커밋: 2차 반영 `fix(ai-adapter)` 커밋
- 병합: `git merge --no-ff feature/006-ai-adapter` → main
- 브랜치 삭제: `git branch -d feature/006-ai-adapter`
