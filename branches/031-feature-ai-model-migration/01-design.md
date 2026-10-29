# 031 feature/ai-model-migration — 설계 문서

## 변경 사유

사용자 결정(2026-10-29):

1. **초상(이미지)** 은 Cloudflare Workers AI(Leonardo Lucid Origin)에서 **OpenAI GPT 이미지 모델**로 옮긴다. 모델은 `gpt-image-2.5-flare`, 품질은 `medium`.
2. **목소리 해설(텍스트)** 은 Claude를 유지한다. 폴백(무료 Workers AI)은 남기되 **Claude가 답하는 비율을 최대한 높인다.** 상위 Claude 모델은 이 작업과 별도로 비교하고, 최종 모델은 사용자가 `TEXT_MODEL`로 정한다(이 작업의 기본값은 `claude-haiku-5-5` 그대로).
3. 초상 속도 제한을 IP당 1분 5회에서 **2회**로 낮춘다. 초상 한 장의 비용이 무료에서 유료로 바뀌기 때문이다.

## 조사한 사실 (2026-10-29, OpenAI 문서)

| 항목 | 내용 | 출처 |
| --- | --- | --- |
| 최신 모델 | `gpt-image-2.5-flare`("빠르고 품질 높은 일상 생성용", 기본 스냅샷 `gpt-image-2.5-flare-2026-09-08`), `gpt-image-2.5-sunburst`(편집 정밀도용), `gpt-image-2`. `gpt-image-1`은 2026-10-23 종료 | 모델 페이지, 이미지 생성 가이드 |
| 엔드포인트 | `POST /v1/images/generations`. GPT 이미지 모델은 언제나 `data[].b64_json`(base64)으로 돌려준다(`response_format` 미지원) | API 레퍼런스 |
| 크기 | 가로·세로 16의 배수, 총 픽셀 655,360~8,294,400, 비율 1:3~3:1. 정사각형은 816×816부터 되고 지금의 768×768(589,824)은 안 된다. 표준 크기는 1024×1024, 1536×1024, 1024×1536 (1차 리뷰 #2로 정정) | 이미지 생성 가이드 |
| 형식 | `output_format` png/jpeg/webp, `output_compression` 0~100(jpeg/webp). "jpeg가 png보다 빠르다" | 이미지 생성 가이드 |
| `seed` | **없다.** 같은 요청이라도 매번 다른 얼굴이 나온다 | API 레퍼런스 |
| 가격 | 이미지 출력 100만 토큰당 $30, 텍스트 입력 $5. **2.5의 장당 가격은 공개되지 않았다**(모델 페이지: "GPT Image 2 계산기는 2.5의 토큰 소비를 추정하지 않는다"). 제3자 자료는 1024×1024 medium 약 $0.013. 같은 토큰 단가인 GPT Image 2 공식 표는 1024×1024 low $0.006 / medium $0.053 / high $0.211. 실측 전에는 **장당 $0.013~0.053** (1차 리뷰 #1로 정정) | 가격표·모델 페이지(토큰 단가), 이미지 생성 가이드(GPT Image 2 표), 제3자 자료 |
| 지연 | 공식 수치는 없다. "복잡한 프롬프트는 최대 2분". 제3자 실측 하나는 flare high 1024×1024가 약 22초 | 이미지 생성 가이드, 제3자 |
| 조직 인증 | GPT 이미지 모델은 사용 전에 API **Organization Verification**이 필요할 수 있다 | 이미지 생성 가이드 |
| 조직 한도 | 사용 등급별: Build(누적 크레딧 구매 $5) 분당 20장, Launch($100) 150장, Grow($500) 250장. 누적 구매액이 기준에 이르면 자동 상향 (1차 리뷰 #3로 정정) | 모델 페이지, rate limits 가이드 |
| 검열 | 막히면 `moderation_blocked` 오류(400) | 이미지 생성 가이드 |

## 범위

### 포함

- `worker/ai/openaiImage.ts`(새 파일): OpenAI 초상 제공자. `fetch` 로 `/v1/images/generations` 를 부르고 data URL로 감싼다. 모델은 `IMAGE_MODEL` 변수로 바꿀 수 있다(기본 `gpt-image-2.5-flare`, `gpt-image-` 식별자만 받는다)
- `worker/ai/select.ts`: `AI_PROVIDER=openai` + 비밀 `OPENAI_API_KEY` 일 때 OpenAI 제공자. 키가 없으면 mock(Workers AI가 바인딩 없을 때와 같은 규칙)
- `shared/api.ts`: `AiProviderName` 에 `'openai'`, 씨앗·초상 시간 주석, 리딩 시간 상수(아래 "Claude 최대화")
- `worker/ai/claude.ts`: 재시도 횟수, 출력 계약 위반 시 한 번 더 부르기
- `worker/ai/textChain.ts`: 예산 배분 주석의 숫자
- `wrangler.jsonc`: `AI_PROVIDER` `"openai"`, `PORTRAIT_LIMITER` 2회, 주석. `worker-configuration.d.ts` 재생성
- 테스트: `openaiImage.test.ts`(새 파일), `select.test.ts`, `claude.test.ts`, `textChain.test.ts`, `worker/index.test.ts`
- `README.md`: AI 소개·기술 스택·개인정보·AI 제공자 절(OpenAI 켜기, 비용·데이터), 시간 예산 숫자, 알려진 한계

### 제외

- Workers AI 초상 제공자(`workersAi.ts`)는 지우지 않는다. `AI_PROVIDER="workers-ai"` 한 줄로 되돌릴 수 있게 남긴다
- 초상 폴백 체인(OpenAI 실패 → Workers AI)은 만들지 않는다. 실패하면 지금처럼 503 → 자리표시 초상이다. 022에서 텍스트를 "모든 사용자가 같은 모델의 결과"로 맞춘 것과 같은 이유로, 두 모델의 얼굴 화풍을 섞지 않는다
- 클라이언트 코드 변경 없음. 클라이언트는 `features.portrait` 와 data URL 계약만 본다
- Claude 모델 변경 없음(비교는 별도로 하고 사용자가 정한다)
- `ai` 바인딩은 남긴다. 리딩 체인의 workers-ai 예비가 쓴다

## OpenAI 초상 제공자

요청:

```json
{ "model": "gpt-image-2.5-flare", "prompt": "<buildPortraitPrompt(typeCode)>", "n": 1, "size": "1024x1024", "quality": "medium", "output_format": "jpeg", "output_compression": 90 }
```

| 결정 | 근거 |
| --- | --- |
| SDK 대신 `fetch` | 엔드포인트 하나, 응답 필드 하나만 쓴다. 의존성과 Worker 번들을 늘리지 않고, 테스트는 `fetch` 주입으로 한다 |
| 1024×1024 | 표준 크기 중 정사각형. 결과 카드는 1:1이다. 816×816 같은 더 작은 사용자 정의 크기도 되지만 2.5의 크기별 토큰 수가 공개되지 않아 실측 전에는 표준 크기를 쓴다(더 작게 할지는 실측 뒤 사용자가 정한다) |
| jpeg, `output_compression` 90(기본 100) | 공식 가이드상 png보다 빠르다. 1024×1024 jpeg는 수백 KB라 클라이언트 상한(`PORTRAIT_IMAGE_MAX_CHARS` 4MB) 안에 넉넉히 든다 |
| `quality: "medium"` 상수 | 사용자 결정. 설정 표면을 늘리지 않으려고 변수로 두지 않는다 |
| 모델은 `IMAGE_MODEL` 변수 | `TEXT_MODEL` 과 같은 방식. 새 모델이 나오면 설정 한 줄로 바꾼다. `gpt-image-` 로 시작하는 식별자만 받는다 |
| `moderation` 은 보내지 않음(기본 `auto`) | 프롬프트는 서버가 타입 코드로만 만들어 검열에 걸릴 내용이 없다. 걸리면 실패 → 자리표시 초상 |
| `seed` 는 보내지 않음 | 지원하지 않는다. 한 녹음에 초상을 한 번만 만들므로 사용자에게 보이는 차이는 없다(README "알려진 한계"에 적는다) |
| 시간 상한은 기존 `PORTRAIT_SERVER_TIMEOUT_MS`(45초) | 중단 신호를 `fetch` 에 건다. 넘으면 `TimeoutError` → 503. medium은 high(제3자 실측 약 22초)보다 빠를 것이라 여유가 있다. 실제 지연은 배포 후 로그로 확인한다 |
| 오류는 상태 코드와 오류 코드만 | `HTTP 400 moderation_blocked` 처럼 남긴다. 응답 본문의 메시지·프롬프트는 로그에 넣지 않는다 |
| 비용 추적 로그 한 줄 | Claude와 같은 방식으로 `[portrait] openai <model> in=… out=…` 토큰 수만 남긴다(운영에서는 observability가 꺼져 있어 저장되지 않는다) |

## Claude 최대화

지금 Claude는 체인 예산 25초 중 뒤 예비 몫 12초를 뺀 **13초**를 받는다. SDK 요청 한 번(12초)과 재시도 1회가 그 안에서만 된다. 출력이 계약(JSON·길이)에 맞지 않으면 다시 부르지 않고 바로 Workers AI로 넘어간다. Claude를 더 많이 쓰려고 다음을 바꾼다.

| 바꾸는 것 | 지금 | 바뀐 뒤 | 효과 |
| --- | --- | --- | --- |
| 체인 예산 `READING_CHAIN_BUDGET_MS` | 25초 | **40초** | Claude 몫이 13초 → **28초**(40 − 12) |
| 클라이언트 대기 `READING_CLIENT_TIMEOUT_MS` | 30초 | **45초** | "클라이언트 대기 > 체인 예산" 규칙 유지(차이 5초 그대로). 초상 클라이언트 60초보다 짧다 |
| SDK 재시도 `MAX_RETRIES` | 1 | **2** | 529 과부하·429처럼 빠르게 실패하는 일시 오류에서 세 번까지 시도한다 |
| 계약 위반 시 다시 부르기 `CONTRACT_RETRIES` | 없음 | **1회** | JSON이 아니거나 길이를 벗어나거나 `max_tokens` 로 잘리면 남은 시간 안에서 Claude를 한 번 더 부른다. 거부(`refusal`)는 같은 프롬프트로 다시 불러도 거부되므로 다시 부르지 않는다 |
| 예비 몫 `FALLBACK_RESERVE_MS` | 12초 | 12초 | Workers AI 실측 1.8~9.4초(011)에 여유 |

시간 관계(테스트로 고정):

- Claude가 예산 전부를 받을 때(체인 밖이거나 유일한 제공자): 요청 12초 × 시도 3번 + 재시도 대기 최대 0.5 + 1초 = **37.5초 ≤ 40초**
- 뒤 제공자가 있을 때(운영 순서): 받은 28초 안에 요청 12초 두 번과 첫 재시도 대기(최대 0.5초)가 다 들어간다(24.5초). 세 번째 시도와 계약 재호출은 남은 시간 안에서만 된다
- 어느 경우든 Claude 전체는 체인이 준 신호에서 끊긴다. Workers AI는 남은 12초 이상으로 시도된다

사용자 대기: Claude가 정상일 때(실측 2~4초)는 그대로다. 리딩은 초상과 병렬이고, 생성 화면은 둘 다 끝나야 넘어간다. Claude가 느리게 실패할 때만 대기가 최대 25초 → 40초로 는다. 사용자가 "Claude를 최대한 많이 쓴다"를 우선했으므로 받아들인다.

비용: 추가 호출은 실패했을 때만 생긴다. 리딩 1회 약 $0.0002라 재시도가 늘어도 무시할 만하다.

## 비용과 속도 제한

| 항목 | 값 |
| --- | --- |
| 초상 1장 | $0.013~0.053(출력, 실측 전 범위) + 프롬프트 약 80토큰 × $5/100만 ≈ **$0.0134~0.0534** |
| 1만 장 | 약 $135~535 |
| IP 하나가 제한을 쉬지 않고 채울 때(2회/분, 콜로별) | 하루 2,880장 ≈ **$39~154** (5회/분이면 7,200장 ≈ $97~385) |
| 전체 상한 | 코드에는 없다(IP가 여럿이면 합산). **OpenAI 쪽 선불 크레딧(자동 충전 끔)과 예산 알림을 실제 상한으로 둔다.** 잔액은 조직 전체가 함께 쓴다 — README와 사용자 안내에 적는다 |
| 확정 | 첫 실호출의 `out=` 출력 토큰 × $30/100만으로 장당 가격을 정하고, 그 값으로 품질·분당 2회를 다시 본다 |

## 개인정보

- OpenAI로 가는 것은 서버가 타입 코드로 만든 영어 프롬프트뿐이다(음성·씨앗·IP·브라우저 정보 없음). OpenAI 문서(Your data)상 `/v1/images/generations` 데이터는 학습에 쓰이지 않고 남용 감시를 위해 30일 보존된다. 요청은 Worker가 보내므로 사용자 IP는 OpenAI에 가지 않는다. `user`·`safety_identifier` 도 보내지 않는다
- 생성된 이미지는 응답으로만 돌아가고 저장하지 않는다(지금과 같음)

## 검증 계획

1. typecheck / lint / test / build 종료 코드 0
2. 단위 테스트: OpenAI 요청 본문·헤더·신호, data URL, HTTP 오류(본문 메시지 비노출), 빈 응답·이상한 형식, 제공자 선택(키 유무), 라우트 끝에서 끝까지(`fetch` 흉내), Claude 계약 재호출(거부는 다시 안 부름), 시간 상수 관계
3. 실제 OpenAI 호출은 키가 없어 이 작업에서 못 한다. 사용자가 키를 넣은 뒤 배포 후 확인(`/api/config` → `provider: "openai"`, `/api/portrait` 한 번, 로그의 토큰 수와 지연)
4. 독립 리뷰 1차 → 반영 → 2차 → 병합 가능이면 `--no-ff` 병합

## 배포 순서 (사용자 작업)

1. OpenAI: 조직 인증, 선불 크레딧(자동 충전 끔)·예산 알림, 이 서비스 전용 API 키 발급
2. Cloudflare: Worker `vocatype` 에 비밀 `OPENAI_API_KEY` 등록(`npx wrangler secret put OPENAI_API_KEY` 또는 대시보드 → Settings → Variables and Secrets → Secret)
3. 이 브랜치를 main에 병합·푸시 → Workers Builds가 배포
4. 키를 넣기 전에 배포되면 `AI_PROVIDER=openai` 라도 키가 없어 mock(자리표시 초상)으로 동작한다. 깨지지는 않는다
