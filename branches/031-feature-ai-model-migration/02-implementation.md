# 031 feature/ai-model-migration — 구현 문서

작업 브랜치: `claude/ai-model-migration-e64f72`(앱이 만든 worktree 브랜치). 병합할 때 규칙 이름은 `feature/031-ai-model-migration`.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `worker/ai/openaiImage.ts` (새 파일) | OpenAI 초상 제공자. `fetch` 로 `POST /v1/images/generations`, 모델 `gpt-image-2.5-flare`(기본, `IMAGE_MODEL`로 변경), 1024×1024, medium, jpeg(`output_compression` 90, 기본 100). 실패는 `OpenAiError: HTTP <상태> <코드>`(200인데 본문이 JSON이 아니면 `HTTP 200 invalid_body`, 1차 리뷰 #4). 성공하면 토큰 수 로그 한 줄 |
| `worker/ai/openaiImage.test.ts` (새 파일) | 요청 본문(씨앗 없음)·헤더·신호, 시간 상한(헤더 전·본문 읽는 중), 오류 메시지 비노출, 200 본문 이상, 빈 응답·이상한 형식, 로그, 모델 이름 검증 — 10건(1차 리뷰 반영 2건 포함) |
| `worker/ai/select.ts` | `AI_PROVIDER=openai` + `OPENAI_API_KEY`(공백 제거 후 비어 있지 않을 때) → OpenAI. 키가 없으면 mock |
| `worker/ai/select.test.ts` | 키 유무, 다른 제공자의 바인딩·키가 섞이지 않음, `parseProviderName('openai')` — 2건 추가, 1건 수정 |
| `shared/api.ts` | `AiProviderName` 에 `'openai'`. 씨앗·초상 시간 주석. `READING_CHAIN_BUDGET_MS` 25초 → 40초, `READING_CLIENT_TIMEOUT_MS` 30초 → 45초 |
| `worker/ai/claude.ts` | `MAX_RETRIES` 1 → 2, `CONTRACT_RETRIES = 1`(계약 위반·`max_tokens` 잘림이면 한 번 더 부름, 거부·시간 초과면 안 부름). 시간 관계 주석 |
| `worker/ai/claude.test.ts` | 계약 재호출 3건 추가(다시 부를 때도 체인의 같은 신호), 오류 전파는 한 번만 부름, 시간 관계 테스트 2건 갱신(37.5초 ≤ 40초, 24.5초 ≤ 28초) |
| `worker/ai/textChain.ts`, `textChain.test.ts` | 주석의 숫자(13초 → 28초), 느린 첫 제공자 흉내를 20초 → 30초(새 몫 28초보다 길게) |
| `worker/index.test.ts` | OpenAI 라우트 끝에서 끝까지(설정·data URL·보내는 값에 IP·UA·씨앗 없음), 실패 시 503과 로그 내용 — 2건. 운영 값 `PRODUCTION_AI_PROVIDER` 를 생성 타입에 묶음 |
| `wrangler.jsonc` | `AI_PROVIDER` `"workers-ai"` → `"openai"`, `PORTRAIT_LIMITER` 5 → 2, 주석 |
| `worker-configuration.d.ts` | `wrangler types` 재생성. 바뀐 것은 해시와 `AI_PROVIDER: "openai"` 두 줄뿐 |
| `README.md` | 소개·기술 스택·폴더 구조·개인정보, AI 제공자 표, "OpenAI 켜기 (현재 운영)", "Workers AI로 되돌리기", 초상 데이터·비용, 리딩 시간 예산과 Claude 재시도, 무료 할당량, 알려진 한계 |

## 주요 구현

### OpenAI 제공자

- 요청 본문은 `buildImageRequest` 하나에서 만든다. 씨앗은 받지만 보내지 않는다(API에 없다).
- 시간 상한은 기존 `PORTRAIT_SERVER_TIMEOUT_MS`(45초)를 `AbortSignal.timeout` 으로 `fetch` 에 건다. 라우트(`worker/index.ts`)는 바꾸지 않았다. 예외 → 503 → 자리표시 초상 경로를 그대로 쓴다.
- 실패 응답은 `error.code`, 없으면 `error.type` 만 꺼낸다. 영숫자·`_.-` 64자 이내일 때만 싣고, 본문이 JSON이 아니면 상태만 싣는다. 응답의 `message` 는 어디에도 싣지 않는다.
- MIME은 Workers AI 제공자의 `detectImageMime` 을 같이 쓴다. jpeg를 요청하지만 다른 형식이 와도 올바른 data URL이 된다.
- 성공(200) 본문 읽기도 보호한다(1차 리뷰 #4). JSON 파서 오류 메시지에는 본문 일부가 들어가므로 `HTTP 200 invalid_body` 로 바꿔 던진다. 시간 상한에 걸린 경우는 그대로 `TimeoutError` 로 둔다. 본문이 `null` 이면 이미지 없음.

### Claude 최대화

`generateReading` 이 한 번 부르고 끝내던 것을 반복문으로 바꿨다. 같은 요청 본문과 같은 신호를 쓴다.

```
부름 → 성공 → 끝
     → 예외(네트워크·HTTP, SDK 재시도 2회 포함) → 신호가 끊겼으면 "time budget exceeded", 아니면 그대로 → 체인이 다음 제공자로
     → 답은 왔지만 계약 위반 → (거부가 아니고, 신호가 살아 있고, 아직 다시 부르지 않았으면) 경고 로그 한 줄 + 한 번 더
```

경고 로그는 `[reading] claude output rejected, retrying: <오류 메시지>` 이다. 메시지는 `reading length 3`·`response is not JSON` 같은 파서 메시지라 응답 본문이 들어가지 않는다(테스트로 고정).

## 설계 대비 달라진 점

- `resolveImageModel` 을 `select.ts` 가 아니라 `openaiImage.ts` 에 두었다. `textChain.ts` 의 `resolveTextModel` 처럼 제공자 모듈 옆에서 기본값과 검증을 함께 본다.
- 오류 코드가 없을 때 `error.type`(예: `insufficient_quota`)으로 대신하는 규칙을 더했다. 잔액 부족을 로그에서 구분하기 위해서다.

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` | 종료 코드 0 |
| `npm run lint` | 종료 코드 0 |
| `npm test` | 38파일 315건 통과(새 테스트 15건). 1차 리뷰 반영 뒤 317건 — 03-review.md |
| `npm run build` | 종료 코드 0. `dist/worker/wrangler.json` 에 `"AI_PROVIDER":"openai"`, 초상 `"limit":2`, 리딩 `"limit":5`. 클라이언트 번들도 바뀐다(`READING_CLIENT_TIMEOUT_MS` 45초) |

변이 확인(코드를 일부러 틀리게 바꾼 뒤 관련 테스트 4파일 실행, 확인 뒤 원래대로 되돌림 — `cmp` 로 같음 확인):

| 변이 | 실패한 테스트 |
| --- | --- |
| `CONTRACT_RETRIES = 0` | 1건 (계약 위반 뒤 다시 부르기) |
| 거부도 다시 부르기 | 1건 (거부는 다시 부르지 않음) |
| 오류 `message` 를 로그에 싣기 | 2건 (제공자·라우트) |
| 키 없이도 OpenAI 선택 | 2건 (선택) |
| `MAX_RETRIES = 3` | 1건 (예산 전부 받을 때 시간 관계) |

## 확인하지 못한 것

- **실제 OpenAI 호출.** 이 환경에 `OPENAI_API_KEY` 가 없다. 요청 형식은 OpenAI API 레퍼런스(2026-10-29)를 따랐고 테스트는 `fetch` 흉내로만 돌았다. 키를 넣고 배포한 뒤 README "OpenAI 켜기" 4단계로 확인한다.
- **OpenAI 지연.** medium 1024×1024 실측이 없다. 45초 상한 안에 들 것으로 본 근거는 제3자의 high 측정(약 22초) 하나뿐이다.
- **장당 비용.** 2.5의 장당 가격은 공개되지 않았다. 제3자 자료 약 $0.013, 같은 토큰 단가인 GPT Image 2 공식 medium $0.053이라 실측 전에는 **$0.013~0.053**로 본다(1차 리뷰 #1, 처음에는 $0.013을 사실처럼 적었다). 첫 호출의 `[portrait] openai … out=…` 출력 토큰 × $30/100만으로 확정한다.
- **과금됐지만 자리표시 초상이 나가는 경로**(1차 리뷰 #6): Worker 45초 끊김(끊긴 생성의 과금 여부 미확인), 사용자가 생성 화면을 떠난 경우 Worker의 OpenAI 호출이 함께 끊기는지, Workers CPU 한도. README "OpenAI 켜기" 4단계에서 `wrangler tail` 결과와 OpenAI 사용량 장수를 대조한다.
- Claude 재시도 효과(실제로 Claude가 답하는 비율이 얼마나 오르는지)는 운영 로그가 꺼져 있어 바로 재지 못한다.

## 상위 Claude 모델 비교

사용자 요청으로 이 작업과 별도로 진행했다(백그라운드 에이전트, 저장소 파일 변경 없음). 키가 없어 **실측은 못 했고** 아래는 문서 기준이다. 가격은 claude-api 스킬 표, 토큰 수는 README의 Haiku 5.5 실측(입력 약 1,200, 출력 160~264)을 모든 모델에 그대로 적용했다. Sonnet·Opus·Fable의 지연은 추정이다.

| 모델 | 입력/출력 $/100만 | 1만 회 | 예상 지연 | 판단 |
| --- | --- | --- | --- | --- |
| `claude-haiku-5-5` (기본) | $0.10 / $0.50 | 약 $2~2.5 | 2.0~3.6초(실측) | 기준 |
| `claude-sonnet-5-5` | $2 / $10 | 약 $40~50 | 약 3~6초 | 바꾼다면 현실적인 후보 |
| `claude-opus-5-5` | $4 / $20 | 약 $80~100 | 약 4~10초 | 짧은 글에서 얻는 것이 적고 12초 상한에 가까워질 수 있다 |
| `claude-fable-5-1` | $10 / $50 | 약 $200~250 | 5~15초 이상 | 과한 사양, 30일 데이터 보존 필수 |

네 모델 모두 운영 요청 형태(effort low, json_schema)를 받으므로 코드 변경 없이 `TEXT_MODEL` 로 바꿀 수 있다. 실측 스크립트는 저장소 밖(세션 임시 폴더)에 있고 `--dry-run`·키 없음 종료를 확인했다. **사용자 결정(2026-10-29): Claude Haiku 5.5 유지.** 기본값이 `claude-haiku-5-5` 라 설정 변경은 없다. 모델을 바꾸려면 `wrangler.jsonc` 의 `vars` 에 `"TEXT_MODEL": "claude-…"` 를 더한다. 요청 1회가 12초(`REQUEST_TIMEOUT_MS`)에 가까운 모델이면 그 값도 함께 봐야 한다.

## 배포 후 확인

사용자 승인("Key's in, merge")에 따라 2026-10-29 11:53:30 KST에 main(`1b182a6`)을 푸시했다. 푸시 전에 `npx wrangler secret list --name vocatype` 로 비밀 이름 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` 가 있는 것을 확인했다(값은 보이지 않는다). Cloudflare Workers Builds가 자동 배포했다: GitHub 커밋 검사 "Workers Builds: vocatype — completed/success"(02:54:27Z), 배포 기록 02:54:22Z, 버전 `5ac8e34d-527f-4854-b837-1206863b805c`.

11:55 KST, `https://vocatype.hs827.workers.dev`:

| 확인 | 결과 |
| --- | --- |
| `GET /`, `GET /api/health` | 200, 200 |
| `GET /api/config` | `{"provider":"openai","textProviders":["claude","workers-ai"],"features":{"portrait":true,"reading":true}}` |
| 배포된 번들 | `index-r8FYHae-.js`(브랜치 빌드와 같은 이름), `index-CpSgsQrj.css` |
| 배포된 JS의 리딩 대기 | `45e3`(`READING_CLIENT_TIMEOUT_MS` 45초) 1건 |

- AI 호출(초상·해설)은 하지 않았다. 초상 한 장은 유료라 사용자 확인 뒤에 README "OpenAI 켜기" 4단계로 본다(장당 가격 확정, 지연, `exceededCpu` 여부, OpenAI 사용량 장수 대조).

### 첫 실호출(2026-10-29 12:06 KST)

사용자 승인("Yes, test one")으로 운영에 초상 한 장을 요청했다(`{"typeCode":"WFQV","seed":123}`). `npx wrangler tail vocatype --format json` 을 켜 둔 채 보냈다.

| 확인 | 결과 |
| --- | --- |
| 응답 | HTTP 200, `provider: "openai"`, 9.57초(curl 전체), 171,131바이트 |
| Worker | outcome `ok`, 벽시계 9,240ms, **CPU 3ms** |
| 로그 | `[portrait] openai gpt-image-2.5-flare in=84 out=439` |
| 이미지 | `data:image/jpeg;base64,…` 171,099자 → jpeg 128,305바이트, 1024×1024 실사 초상(프롬프트대로 따뜻한 조명·밝은 미소·따뜻한 톤 옷) |
| 장당 가격 | 출력 439 × $30/100만 = $0.01317 + 입력 84 × $5/100만 = $0.00042 → **약 $0.0136**. 범위($0.013~0.053)의 아래쪽, 제3자 수치와 같은 출력 토큰 |

- 조직 인증·키 권한 문제 없음(403 없이 성공).
- 표본은 1장이다. README·`wrangler.jsonc`·`openaiImage.ts` 주석의 비용을 실측 단가로 바꿨다(하루 IP당 약 $39, 1만 장 약 $136).
- 품질 medium·분당 2회는 실측 단가가 사용자 결정 당시 전제($0.013)와 같아 그대로 둔다.
- 해설(Claude)은 이번에 부르지 않았다.
