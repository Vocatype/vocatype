# 011 chore/enable-claude-chain — 구현 문서

## 요약

배포 리딩 체인을 `workers-ai` → `workers-ai,claude`로 바꿨다(운영 비밀 `ANTHROPIC_API_KEY`는 사용자가 `wrangler secret put`으로 넣었고 이름만 확인했다).
010에서 미확인이던 무료 모델의 실제 출력을 같은 프롬프트·같은 파서로 실측한 결과, **Llama 3.3 70B는 영어에서 2/2회 문장을 끝내지 못하고 `max_tokens`까지 달려 JSON이 깨지고 27~30초를 써 체인 시간 예산(25초)까지 소진**했다. 그래서 무료 모델 상수를 **Llama 4 Scout**(`@cf/meta/llama-4-scout-17b-16e-instruct`, ko/en 8/8회 통과, 2~9초, 1회 약 22~25뉴런)로 바꾸고 `max_tokens`를 512로 낮췄다. 체인 순서는 설계대로 무료 → Claude를 유지한다.
012 이후 설정 이름과 배포 Worker 이름이 모두 `vocatype`이라 `--name`은 필요 없다. 저장소·설정·문서 어디에도 키 값은 없다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `wrangler.jsonc` | `vars.TEXT_PROVIDER`: `"workers-ai"` → `"workers-ai,claude"` |
| `worker-configuration.d.ts` | `wrangler types` 재생성 후 로컬 `.dev.vars`가 넓힌 타입을 깨끗한 출력대로 복원: `AI_PROVIDER: "workers-ai"`, `TEXT_PROVIDER: "workers-ai,claude"`, `ANTHROPIC_API_KEY` 항목 제거(012가 넓어진 채로 커밋한 것도 함께 바로잡음) |
| `worker/ai/workersAiText.ts` | 모델 상수 `@cf/meta/llama-3.3-70b-instruct-fp8-fast` → `@cf/meta/llama-4-scout-17b-16e-instruct`, `MAX_TOKENS` 1024 → 512, 주석에 실측 근거 |
| `worker/ai/workersAiText.test.ts`, `worker/index.test.ts` | 고정된 `max_tokens`·모델 이름 기대값 갱신(운영 모델을 테스트가 단언) |
| `README.md` | 리딩 모델 이름(세 곳)과 리딩 1회 뉴런(약 70 → 약 25, 실측) |
| `branches/011-chore-enable-claude-chain/` | 설계·구현·리뷰 문서 |

체인 코드(`textChain.ts`)·프롬프트·출력 검증·클라이언트는 변경 없음.

## 무료 모델 실측

### 방법

- 저장소 밖 임시 하네스(`wrangler dev`, AI 바인딩만)가 프로젝트의 `buildWorkersAiTextInput`·`parseWorkersAiTextResult`를 그대로 import해 모델 이름만 바꿔 호출했다. 즉 **운영과 같은 시스템 프롬프트·사용자 메시지·JSON 스키마·`max_tokens: 1024`(당시)·같은 파서**다.
- 입력은 README의 curl 예시(`WFQV`, ko)와 010이 쓴 `CFQV`(en), 교차로 `WFQV` en·`CFQV` ko. 축 값은 README 예시 그대로.
- 판정 기준: 문장 수 3~4, 캡션 ko 28자 / en 60자 이내, 성별·나이·외모 표현 없음, 수치·축 이름·타입 코드 인용 없음, 한국어는 해요체·"당신" 반복 없음, 파서 통과 여부, 소요 시간, 뉴런(`usage.neurons`).
- 2026-10-20 12:06 KST에는 할당량 소진(`4006`)이었으나 12:26 KST에 다시 호출이 됐다. 설계의 "UTC 자정 초기화" 가정은 틀렸고 실제 경계는 확인하지 못했다(관찰만 기록).

### 결과

| 시각(KST) | 모델 | 언어/타입 | 시간 | 출력 토큰 | 뉴런 | 결과 |
| --- | --- | --- | --- | --- | --- | --- |
| 12:26 | Llama 3.3 70B (빌드본 체인, 8788) | ko WFQV | 4.0s | 92 | — | 통과했지만 네 절이 **쉼표로 이어진 한 문장**(마침표 없음) |
| 12:26 | Llama 3.3 70B | ko WFQV | 4.7s | 143 | 47.4 | 통과. 4문장 200자, 캡션 "따뜻한 불꽃"(6자) |
| 12:27 | Llama 3.3 70B | **en CFQV** | **30.6s** | **1024(상한)** | **227.2** | **실패**: 문장을 끝내지 못하고 상한까지 달림 → JSON 잘림 → `response is not JSON` |
| 12:27 | Llama 3.3 70B | ko CFQV | 3.3s | 117 | 41.9 | 통과. 4문장 155자, 캡션 "새벽 도시의 앵커"(9자) |
| 12:28 | Llama 3.3 70B | **en WFQV** | **27.5s** | **1024(상한)** | **227.5** | **실패**: 위와 같은 폭주 |
| 12:27 | Llama 4 Scout | ko WFQV | 5.3s | 80 | 22.2 | 통과. 4문장 108자, 캡션 20자 |
| 12:27 | Llama 4 Scout | en CFQV | 3.8s | 101 | 23.4 | 통과. 4문장 392자, 캡션 30자 |
| 12:29 | Llama 4 Scout | ko CFQV | 9.4s | 98 | 23.5 | 통과. 4문장 132자, 캡션 14자 |
| 12:29 | Llama 4 Scout | en WFQV | 5.2s | 112 | 24.5 | 통과. 4문장 440자, 캡션 47자 |
| 12:29 | Llama 4 Scout | ko WFQV(재시도) | 3.1s | 91 | 23.0 | 통과. 앞 결과와 거의 같은 문장(출력이 안정적) |
| 12:29 | Llama 4 Scout | en CFQV(재시도) | 1.8s | 87 | 22.4 | 통과 |
| 12:27 | Qwen3 30B A3B | ko WFQV | 6.1s | 1024(상한) | 34.3 | **실패**: 사고 토큰이 상한을 먹어 응답이 `{"reading": "당신의 목소리는 …` 에서 잘림("당신" 사용) |
| 12:27 | Qwen3 30B A3B | en CFQV | 4.0s | 717 | 24.8 | 통과(3문장). 캡션에 em dash. 사고 토큰으로 출력 토큰이 7배 |

모든 통과 샘플에서 성별·나이 금지어, 숫자, "당신"(한국어)은 0건. 빌드본 체인 확인(아래)에서 Scout가 ko/en 2/2회 더 통과해 Scout는 합계 8/8이다.

### 실제 응답 발췌

Llama 3.3 70B, ko `CFQV` (통과):
> 목소리는 차가운 바람처럼 맑고 선명해요. 빠른 속도로 정보를 전달하면서도 강조와 조절을 통해 핵심을 잘 전달해요. 목소리의 질감은 꽉 찬 느낌을 주며, 톤의 변화도 생동감을 주어 듣는 사람의 관심을 끌어요. 목소리 속도는 빠르지만, 명료하고 간결한 표현으로 핵심을 잘 전달해요. — 캡션: 새벽 도시의 앵커

Llama 3.3 70B, en `CFQV` (실패, 앞부분만):
> {"reading": "Your voice has a unique way of drawing people in, with a warm and inviting quality that makes them want to listen, and a quick pace that keeps them engaged, as if you're sharing a secret that can't wait to be told, with a full and vivid flow that brings your words to life, and a sense of clarity that cuts through the noise, … (1024토큰까지 한 문장으로 이어지다 잘림)

Llama 4 Scout, ko `WFQV` (통과):
> 목소리가 따뜻하고 풍부하게 느껴져요. 말하는 속도가 빨라서 이야기가 생생하게 전달되는 것 같아요. 목소리의 변화가 많아서 듣는 사람을 흥미롭게 만드는 힘이 있네요. 이야기를 할 때 목소리가 꽉 차 있어서 듣는 사람이 빠져들기 쉬운 것 같아요. — 캡션: 따뜻한 말투가 이야기를 가득 채우네요

Llama 4 Scout, en `WFQV` (통과):
> Your voice has a remarkable ability to draw people in, making them feel like they're sharing in a special secret. With a warmth that feels like a gentle hug, you bring a sense of comfort and approachability to everything you say. Your words flow quickly, but not hastily, allowing your listeners to absorb the nuances of your stories. As you speak, your voice bends and turns with a lively rhythm, keeping your audience engaged and curious. — 캡션: Your voice wraps listeners in a warm, cozy glow

### 판정과 선택

- **Llama 3.3 70B**: 한국어는 통과하지만(한 번은 쉼표 나열), 영어는 2/2회 폭주. 폭주 한 번이 27~30초·약 227뉴런이고, 체인 시간 예산 25초를 넘겨 **Claude 폴백도 건너뛰고 mock으로 끝난다**(영어 사용자는 리딩을 못 본다). 운영 모델로 부적합.
- **Qwen3 30B A3B**: 사고 토큰이 출력 상한을 먹어 한국어가 잘리고, "당신"을 쓴다. 부적합.
- **Llama 4 Scout**: 8/8 통과, 2~9초, 뉴런은 3.3의 절반. 한국어는 3.3보다 수식이 단순하지만 자연스럽고 규칙을 지킨다(해요체·네요체 섞임은 허용 범위). 영어는 풍부하고 규칙을 지킨다. **선택.**
- `max_tokens` 512: 실측 출력이 80~143토큰이라 5배 여유다. 상한을 절반으로 줄여 폭주가 나더라도 체인 예산 안에서 끝나 Claude로 넘어갈 여지를 남긴다(Workers AI 바인딩 호출은 중단 신호를 받지 못하므로 상한이 유일한 시간 제동이다).
- 체인 순서는 `workers-ai,claude` 유지(무료 우선 원칙). 순서를 뒤집을 이유가 없어졌다.

## 체인 동작 확인 (빌드본, workerd)

`npm run build` 뒤 `npx wrangler dev -c dist/worker/wrangler.json --port 8788 --var TEXT_PROVIDER:workers-ai,claude`(키는 빌드가 복사한 로컬 `.dev.vars`에서, 원본 `.dev.vars`는 수정하지 않음):

| 호출 | 결과 |
| --- | --- |
| `GET /api/config` | `{"provider":"workers-ai","textProviders":["workers-ai","claude"],"features":{"portrait":true,"reading":true}}` |
| `POST /api/reading` ko `WFQV` | 200, `provider: "workers-ai"`, 5.2초, 로그 `[reading] workers-ai @cf/meta/llama-4-scout-17b-16e-instruct in=651 out=91` |
| `POST /api/reading` en `CFQV` | 200, `provider: "workers-ai"`, 7.6초, `in=637 out=89` |
| 같은 빌드본, 모델 교체 전(12:26) | ko 4.0초 `provider: "workers-ai"`(3.3 70B, 쉼표 나열) — 할당량 소진 상태였던 12:06에는 `4006` → `provider: "mock"` |

4006 → Claude 폴백 경로는 010에서 같은 체인 코드로 실증했고 이번 변경은 설정값·모델 상수뿐이라 다시 유료 호출을 내지 않았다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 할당량 초기화(UTC 자정 가정)를 기다려 실측 | 같은 날 12:26 KST에 호출이 돼 바로 실측 | 12:06 소진 → 12:26 가능. 초기화 경계는 UTC 자정이 아니며 실제 규칙은 확인 못 함 |
| 모델 상수만 교체 | 상수 + `MAX_TOKENS` 1024 → 512 | 실측된 실패 형태가 "문장이 끝나지 않는 폭주"라 상한이 곧 시간 제동이다. 실측 출력(80~143토큰)의 5배 여유 |
| 비밀 등록 요청 후 대기 | 재개 시점에 이미 등록돼 있었음(`secret list`, 03:10Z "Secret Change" 배포) | 012 구현 문서의 안내로 사용자가 먼저 넣었다 |
| README에 `--name` 안내 추가 | 불필요 | 012로 설정 이름 = 배포 이름 = `vocatype` |
| 리딩 1회 "약 70뉴런" | 3.3 70B 실측 42~47, Scout 22~25 | `usage.neurons` 실측. README 수정 |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 (`Env.TEXT_PROVIDER: "workers-ai,claude"`, Scout 입력 타입에 `response_format` 있음) |
| 린트 | `npm run lint` | 경고 0, 오류 0 |
| 단위 테스트 | `npm test` | 28 파일 181 테스트 통과 |
| 빌드 | `npm run build` | 통과. `dist/worker/wrangler.json` → `name: vocatype`, `vars.TEXT_PROVIDER: "workers-ai,claude"`, 번들에 Scout 모델 이름 포함 |
| 키 유출 | `git grep -i 'sk-ant'` | 테스트의 `sk-ant-test`·README 자리표시 `sk-ant-…`뿐 |
| 운영 비밀 | `npx wrangler secret list` | `ANTHROPIC_API_KEY`(secret_text) 이름만 |
| 체인 실제 동작 | 위 표 | `/api/config` 두 제공자, ko/en 리딩 Scout 응답 |

## 알려진 한계

- Workers AI 바인딩 호출은 중단 신호를 받지 못한다. Scout에서 폭주는 관찰되지 않았지만, 난다면 512토큰까지 달린 뒤에야 다음 제공자로 넘어간다. 제공자 자체 타임아웃(예: 12초 `Promise.race`)을 두면 더 확실하다(후속 작업 후보).
- Scout의 출력은 같은 입력에 거의 같은 문장을 낸다(기본 temperature). 다양성이 필요하면 별도 검토.
- 초상이 무료 할당량을 먼저 소진하는 구조는 그대로다. 소진 뒤 리딩은 Claude가 답한다(1회 약 $0.0002).

## 배포 후 확인

main `cf6c122`(병합 커밋)이 12:35 KST에 origin에 푸시됐고, 12:35:49Z(12:35 KST) 배포(`wrangler deployments list` Source "Unknown (deployment)")가 그 내용을 올렸다. 12:37~12:40 KST에 배포 주소 `https://vocatype.hs827.workers.dev`에서 확인:

| 호출 | 결과 |
| --- | --- |
| `GET /api/config` | `{"provider":"workers-ai","textProviders":["workers-ai","claude"],"features":{"portrait":true,"reading":true}}` — **claude가 체인에 들어감** |
| `POST /api/reading` ko `WFQV` | 200, `provider: "workers-ai"`, 2.8초. 4문장, 캡션 "따뜻한 말투가 이야기를 가득 채우네요"(17자) |
| `POST /api/reading` en `CFQV` | 200, `provider: "workers-ai"`, 2.6초. 4문장, 캡션 "Your voice cuts through with clarity"(36자) |
| `POST /api/reading` ko `CLME`(느긋·가벼운 쪽 타입) | 200, `provider: "workers-ai"`, 4.4초. "목소리가 맑고 가벼운 느낌을 주네요. 말하는 속도가 느긋하고, 음의 흐름이 고르며 안정감이 있어요. …" 캡션 "아침의 고요함을 담은 목소리"(14자) |
| `POST /api/reading` en `WLME` | 200, `provider: "workers-ai"`, 3.6초. 4문장, 캡션 "Soothing voice, calm and gentle"(31자) |
| `npx wrangler tail --format json` | `[reading] workers-ai @cf/meta/llama-4-scout-17b-16e-instruct in=651 out=103`, `in=637 out=87` — **배포본이 Scout를 쓴다.** `falling back`·`all providers failed` 0건 |

- 네 타입(`WFQV`, `CFQV`, `CLME`, `WLME`) 모두 성별·나이 표현·숫자·"당신" 없음, 캡션 길이 한도 안. 리뷰 #3(타입 다양성)은 이것으로 보완.
- 확인 시점에는 무료 할당량이 남아 있어 Claude 경로는 운영에서 타지 않았다. 할당량 소진 뒤에는 로그에 `[reading] workers-ai failed, falling back: AiError: 4006 …` 다음 `[reading] claude claude-haiku-5-5 in=… out=…`가 찍히고 응답 `provider: "claude"`가 와야 한다(010에서 같은 코드로 실증).
- tail 원본(JSON)은 요청 메타데이터가 들어 있어 `[reading]` 줄만 옮겨 적고 지웠다.
