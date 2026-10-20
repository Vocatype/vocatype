# 010 feature/text-provider-chain — 설계 문서

## 변경 사유

009(목소리 리딩, main 병합 커밋 `b75eba3` 이후 `b95f562`)는 텍스트 제공자를 **하나만** 고르는 구조였다(`TEXT_PROVIDER = mock | claude`). 병합 직후 요구사항이 바뀌었다(사용자 확인):
**"최대한 무료를 쓰되, 안 되면 Anthropic API 키를 사용한다."**

그래서 텍스트 제공자를 **폴백 체인**으로 바꾼다. 무료인 Workers AI 텍스트 모델을 먼저 쓰고, 실패(무료 할당량 소진 `4006`, 429, 그 밖의 예외, 출력 형식 불일치)하면 Claude(키가 있을 때만), 그것도 실패하면 지금의 모의 고정 문구로 끝낸다.

## 목표

- 체인 순서: `workers-ai` → `claude` → `mock`(항상 마지막, 실패하지 않음)
- 설정 한 줄(`TEXT_PROVIDER`, 콤마 목록)로 체인을 정하고, 기본값은 키 없이도 도는 `"workers-ai"`
- 응답에 **누가 답했는지**(`provider`)를 담고, Worker 로그에 폴백 이유(오류 이름·메시지만)를 남긴다
- 두 모델이 **같은 프롬프트·같은 출력 계약**(리딩 3~4문장, 캡션 한 줄, ko/en, JSON 스키마)을 쓴다
- 009의 개인정보 원칙 유지: 서버로 가는 것은 타입 코드·여섯 축·언어뿐

## 범위

### 포함

- `shared/api.ts`: `TextProviderName`에 `'workers-ai'` 추가, `/api/config`의 `textProvider` → `textProviders: TextProviderName[]`(체인), `ReadingResponse.provider`는 그대로(답한 제공자)
- `worker/ai/readingOutput.ts`: Claude·Workers AI가 함께 쓰는 출력 파서(`parseReadingJson`): JSON 파싱, 형태, 공백 정리, 길이 검증
- `worker/ai/workersAiText.ts`: Workers AI 텍스트 제공자(모델 상수, JSON 모드, 같은 프롬프트)
- `worker/ai/claude.ts`: 파서를 공용 모듈로 옮기고 나머지는 유지
- `worker/ai/textChain.ts`: 설정 파싱(`parseTextProviderChain`), 사용 가능한 제공자 조립(`buildTextChain`), 폴백 실행(`createTextChain`)
- `worker/ai/textSelect.ts` → `textChain.ts`로 대체(단일 선택 함수 삭제)
- `worker/ai/textMock.ts`: 고정 문구를 체인 중립 문구로("설정된 제공자가 모두 꺼져 있거나 실패")
- `worker/index.ts`: `/api/config`에 `textProviders`, `/api/reading`은 체인 호출(체인은 던지지 않지만 503 경로는 안전망으로 유지)
- `wrangler.jsonc`: `vars.TEXT_PROVIDER = "workers-ai"`; `worker-configuration.d.ts` 재생성
- `src/features/ai/client.ts`: `provider === 'mock'`이면 리딩 없음(`null`)으로 보고 카탈로그 설명으로 폴백; 오프라인 설정 갱신
- README: 체인 설정법, 무료 할당량(하루 10,000뉴런)을 이미지와 텍스트가 **함께** 쓴다는 점, 비용 어림, Claude 켜기 절차를 체인 기준으로
- 테스트: 설정 파싱(순서·중복·모르는 값·키 없을 때 claude 제외·바인딩 없을 때 workers-ai 제외), 체인(첫 제공자 실패 → 두 번째, 전부 실패 → mock, 로그), Workers AI 제공자(JSON 모드 입력, 문자열/객체 응답 파싱, 형식 불일치 → 예외), 라우트(`provider` 필드, `textProviders`), 클라이언트(`mock` → null)

### 제외

- 초상(이미지) 제공자 변경 없음
- 리딩 캐시 없음(응답으로만 돌아간다)

## 설정

| `TEXT_PROVIDER` | `AI` 바인딩 | `ANTHROPIC_API_KEY` | 체인 | `features.reading` |
| --- | --- | --- | --- | --- |
| 없음 / `""` / 모르는 값만 | — | — | (없음) → mock | false |
| `workers-ai` (기본) | 있음 | — | workers-ai → mock | true |
| `workers-ai,claude` | 있음 | 있음 | workers-ai → claude → mock | true |
| `workers-ai,claude` | 있음 | 없음 | workers-ai → mock (claude 조용히 제외) | true |
| `claude` | — | 있음 | claude → mock | true |
| `claude,workers-ai` | 있음 | 있음 | claude → workers-ai → mock (순서는 목록 순) | true |
| `mock` | — | — | (없음) → mock | false |

콤마로 나누고 공백을 지운 뒤 아는 이름만 순서대로, 중복은 처음 것만 남긴다. `mock`은 명시해도 체인에 넣지 않는다(항상 마지막 안전망).

## 체인 동작

```
for provider of chain:
  try  → output = provider.generateReading(input)  → 응답 { reading, caption, provider: provider.name }
  catch → console.warn('[reading] <name> failed, falling back: <ErrName>: <message>'); continue
all failed → console.error('[reading] all providers failed (…), using mock') → mock 고정 문구, provider: 'mock'
```

- 실패로 보는 것: 예외 전부(Workers AI `AiError 4006` 할당량 소진·`429`, Anthropic 401/429/529, 타임아웃, 거부, JSON 파싱 실패, 길이 범위 밖)
- 체인은 던지지 않는다. 라우트의 503 경로는 예상 못한 오류의 안전망으로만 남는다
- 클라이언트는 `provider === 'mock'`이면 리딩이 없는 것으로 보고 카탈로그 설명을 쓴다(사용자에게 모의 문구를 보이지 않는다)

## Workers AI 텍스트 제공자

- 모델 상수 `WORKERS_AI_TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'`. 근거: 생성 타입에 JSON 모드(`response_format`)가 있고, 한국어 품질이 8B 모델보다 낫다. 뉴런은 1회 약 70(8B는 약 45)으로 하루 무료 10,000뉴런 안에서 차이가 작다. 8B(`@cf/meta/llama-3.1-8b-instruct-fp8`)로 바꾸려면 상수만 바꾼다. (현재 생성 타입 목록에 `@cf/meta/llama-3.1-8b-instruct`(기본형)은 없다.)
- 입력: 009와 같은 `READING_SYSTEM_PROMPT`·`buildReadingUserMessage`를 `messages`로, `response_format: { type: 'json_schema', json_schema: READING_OUTPUT_SCHEMA }`, `max_tokens: 600`
- 출력: `response`가 문자열이면 JSON 파싱, 객체면 그대로 공용 파서에 넘긴다. 실패하면 예외 → 다음 제공자
- 바인딩은 `remote: true`라 로컬 개발에서도 Cloudflare 계정을 통해 호출되며 무료 할당량을 쓴다

## /api/config

```
{ provider, textProviders: ['workers-ai', 'claude'], features: { portrait, reading: textProviders.length > 0 } }
```

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| 무료 → 유료 순서를 설정 목록 순서로 | "최대한 무료" 요구를 기본값(`workers-ai`)으로 표현하고, 운영자가 순서를 바꿀 수 있게 한다. |
| 키 없으면 `claude` 조용히 제외 | 009와 같은 원칙. 설정 실수가 503 폭주나 가짜 실패 로그로 이어지지 않는다. |
| 체인 끝은 mock, 클라이언트가 `mock`을 "없음"으로 처리 | 라우트는 항상 200으로 답해 콘솔 오류를 남기지 않고, 사용자에게는 모의 문구 대신 카탈로그 설명이 보인다. |
| 공용 출력 파서 | 두 모델이 같은 계약을 지키는지 한 곳에서 검증한다. Llama가 스키마를 어겨도 같은 기준으로 다음 제공자로 넘어간다. |
| 3.3 70B fp8 fast | 한국어 문장 품질. 뉴런 차이가 작다. 상수로 교체 가능. |
| Workers AI에 `max_tokens: 600` | 리딩+캡션 JSON은 300토큰 안쪽이다. Llama는 사고 토큰이 없다. |
| 로그는 오류 이름·메시지만 | 폴백 이유를 운영에서 알 수 있어야 한다. 요청 본문·축 값은 넣지 않는다. |

## 비용 어림

- Workers AI 무료: 하루 10,000뉴런을 **초상(이미지)과 리딩(텍스트)이 함께** 쓴다. 초상 1장(768×768)이 수백 뉴런, 리딩 1회가 약 70뉴런이므로 소진은 대체로 초상이 먼저 일으키고, 그 뒤 리딩은 `4006` → Claude로 넘어간다.
- Claude(Haiku 5.5): 009 실측 1회 약 $0.0002.

## 검증 계획

1. typecheck / lint / test / build 통과, `wrangler types` 재생성
2. 단위 테스트: 설정 파싱 표의 모든 행, 체인 순서·폴백·전부 실패, Workers AI 응답(문자열/객체/형식 불일치), 라우트 `provider`·`textProviders`, 클라이언트 `mock` → null
3. 로컬(`.dev.vars`에 `TEXT_PROVIDER=workers-ai,claude`와 키): `POST /api/reading` 1회. 할당량이 남아 있으면 `provider: "workers-ai"`와 한국어 품질 확인, 소진돼 있으면 로그에 `workers-ai failed … 4006` 뒤 `provider: "claude"`가 오는지 확인(폴백 경로 실증)
4. 리뷰 한 차례(독립 리뷰 에이전트) → 반영 → `--no-ff` 병합 → 브랜치 삭제
