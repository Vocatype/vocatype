# 009 feature/voice-reading — 설계 문서

## 목표

결과 화면에 사람마다 다른 "목소리 리딩" 문단(3~4문장)과 공유용 한 줄 캡션을 ko/en으로 보여 준다.
텍스트는 Worker 쪽 **텍스트 제공자** 어댑터가 만들고, 기본 구현은 Claude API(`@anthropic-ai/sdk`, 모델 `claude-haiku-5-5`)다.
초상(이미지)은 Claude가 만들지 못하므로 기존 Workers AI 경로(006~008)를 그대로 둔다.

서버로 가는 데이터는 **타입 코드, 6축 수치(0..1, 소수 둘째 자리), 언어**뿐이다. 음성·녹음 길이·IP·언어 외 환경 정보는 보내지 않는다.

## 범위

### 포함

- `shared/api.ts`: `/api/reading` 계약(`ReadingRequest`, `ReadingResponse`), `/api/config`에 `textProvider`·`features.reading` 추가, 길이 상한 상수
- `worker/ai/types.ts`: `TextProvider` 인터페이스 (`generateReading({ typeCode, axes, locale }) → { reading, caption }`)
- `worker/ai/textMock.ts`: 고정 문구를 돌려주는 모의 텍스트 제공자
- `worker/ai/readingPrompt.ts`: 서버가 만드는 프롬프트(시스템·사용자 메시지)와 JSON 출력 스키마
- `worker/ai/claude.ts`: Claude 제공자(구조화 출력, 거부·형식 오류 처리, 길이 검증)
- `worker/ai/textSelect.ts`: `TEXT_PROVIDER`·`ANTHROPIC_API_KEY`·`TEXT_MODEL`로 제공자 선택
- `worker/reading.ts`: 요청 검증(타입 코드, 6축 0..1, 로케일, 1KB 바이트 제한)
- `worker/index.ts`: `POST /api/reading`(교차 사이트 403, 속도 제한 429, 400/413, 제공자 실패 503)
- `wrangler.jsonc`: `vars.TEXT_PROVIDER = "mock"`, `ratelimits` `READING_LIMITER`; `worker-configuration.d.ts` 재생성
- `src/features/ai/client.ts`: `requestReading` (타임아웃, 실패 시 `null`, 응답 형식 검증), 축 반올림
- `src/screens/GeneratingScreen.tsx`: 초상 요청과 **병렬**로 리딩 요청, 실패해도 결과로 진행
- `src/App.tsx`, `src/screens/ResultScreen.tsx`: 리딩 상태 전달, 초상 카드 아래 리딩 카드(문단 + 캡션)
- `src/features/export/renderCard.ts`: 저장 이미지에 캡션 **한 줄**만 추가(세로 예산 1800 안), 예산 테스트 갱신
- i18n 문구(ko/en), CSS
- 단위 테스트: 제공자 선택, 프롬프트, Claude 응답 파싱, 요청 검증, 라우트, 클라이언트 폴백, 카드 예산
- README: 켜는 방법, 비용, 보내는 데이터, 개인정보 원칙 갱신

### 제외

- 초상 생성 제공자 변경(Claude는 이미지를 만들지 않는다)
- 리딩 캐시·저장. 응답으로만 돌아가고 서버에 남지 않는다.
- 결과 화면에서 언어를 바꿨을 때 리딩을 다시 생성하는 것(아래 "언어 불일치 규칙" 참고)

## API 계약

```
GET  /api/config  → 200 { provider, textProvider: 'mock' | 'claude', features: { portrait, reading } }
POST /api/reading { typeCode: 'WFQV', axes: { warmth, density, pace, variation, pitch, brightness }, locale: 'ko' | 'en' }
                  → 200 { reading: '…(3~4문장)', caption: '…(한 줄)', provider }
                  → 400 { error: 'invalid_request' }   잘못된 코드·축·로케일
                  → 403 { error: 'forbidden' }         다른 사이트에서 온 요청
                  → 413 { error: 'too_large' }         본문 1KB 초과
                  → 429 { error: 'rate_limited' }      IP당 1분 5회 초과
                  → 503 { error: 'provider_failed' }   제공자 오류·거부·형식 불일치 (클라이언트는 null로 처리)
```

축은 0..1 사이 유한한 수만 받고 서버가 소수 둘째 자리로 다시 반올림한다. 추가 필드는 버린다.
프롬프트는 서버가 만들므로 클라이언트가 임의 문장을 생성시킬 수 없다.

## 흐름

```
GeneratingScreen
  ├─ analyzeRecording()                         (기기 안)
  ├─ fetchAiConfig()
  └─ Promise.all([
       features.portrait ? requestPortrait({ typeCode, seed })                : null,
       features.reading  ? requestReading({ typeCode, axes(반올림), locale })  : null,
     ]) ──▶ onGenerated({ profile, portrait, reading })
```

ResultScreen: `reading`이 있고 `reading.locale`이 현재 언어와 같을 때만 초상 카드 아래에 리딩 카드를 그린다.
없으면 지금처럼 카탈로그의 고정 설명만 보인다(폴백). 저장 이미지에는 캡션 한 줄만 들어간다(없으면 그 줄을 비운다).

## 제공자 선택

| `TEXT_PROVIDER` | `ANTHROPIC_API_KEY` | 결과 |
| --- | --- | --- |
| 없음 / `mock` / 그 밖의 값 | — | 모의 제공자 (`features.reading: false`, 라우트는 고정 문구 200) |
| `claude` | 없음 | 모의 제공자 (키가 없으면 켜지지 않는다) |
| `claude` | 있음 | Claude 제공자. 모델은 `TEXT_MODEL`(없으면 `claude-haiku-5-5`) |

API 키는 `wrangler secret put ANTHROPIC_API_KEY`로만 넣는다. 저장소와 `wrangler.jsonc`에는 넣지 않으며, 로컬은 gitignore된 `.dev.vars`를 쓴다.

## 프롬프트

- 시스템 프롬프트(영어, 고정): 역할(목소리 타입 카드의 짧은 리딩 작가), 형식(3~4문장, 2인칭, 캡션 한 줄), **금지 사항**: 성별·나이·인종·국적·외모·건강·감정 상태 추정 금지, 진단·조언 금지, 수치 인용 금지, 이름 호칭 금지, 이모지·해시태그 금지, 요청한 언어로만 작성.
- 사용자 메시지: 타입 코드, 타입 이름(요청 언어·영어), 네 축 글자 뜻, 6축 수치(소수 둘째 자리)와 각 축의 의미, 출력 언어.
- 출력: 구조화 출력(`output_config.format`, JSON 스키마 `{ reading, caption }`)으로 받아 파싱 실패를 없앤다.
- 호출: `output_config.effort: 'low'`, `max_tokens: 1024`(적응형 사고가 켜져 있어 여유를 둔다), SDK `timeout` 12초 · `maxRetries` 1.
- 응답 검증: `stop_reason === 'refusal'`이면 실패, 텍스트 블록을 `type`으로 찾아 JSON 파싱, 공백 정리 후 리딩 20~600자·캡션 2~100자(한 줄)만 통과. 그 밖은 503.

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| 텍스트 제공자를 이미지 제공자와 별도 인터페이스로 | 둘은 켜지는 조건(바인딩 vs 비밀 키)과 제공자가 다르다. `/api/config`가 두 기능을 따로 알린다. |
| 기본 모델 `claude-haiku-5-5`, `TEXT_MODEL`로 변경 | 3~4문장 생성은 Haiku로 충분하고 가장 싸다. 모델 값은 `claude-`로 시작하는 문자열만 받는다. |
| 구조화 출력(JSON 스키마) | 자유 텍스트에서 문단과 캡션을 가르는 휴리스틱이 필요 없다. 5.x 모델은 프리필을 받지 않으므로 형식 제어는 이 방법이 맞다. |
| 별도 속도 제한 `READING_LIMITER` (IP당 1분 5회) | 초상과 리딩은 한 번의 생성에서 같이 나간다. 바인딩을 공유하면 초상 한도가 절반이 된다. |
| 모의 제공자 `supportsReading: false` | 초상 모의 제공자와 같은 규칙. 운영에서 기본값(mock)일 때 사용자에게 고정 문구가 보이지 않는다. 라우트 자체는 고정 문구를 돌려줘 로컬·테스트에서 쓸 수 있다. |
| 키가 없으면 mock으로 | `AI_PROVIDER=workers-ai`에 바인딩이 없으면 mock인 것과 같다. 설정 실수가 503 폭주로 이어지지 않는다. |
| 언어 불일치 규칙 | 리딩은 생성 시점 언어로 한 번 만든다. 결과 화면에서 언어를 바꾸면 다른 언어의 리딩을 보여 주지 않고 카탈로그 설명으로 돌아간다. 다시 생성하면 API 비용이 들고 흐름이 복잡해진다. |
| 캡션만 저장 이미지에 | 1080×1920 카드의 세로 예산이 빠듯하다(최악 조합이 1800 근처). 한 줄(말줄임)로 제한하고 예산 테스트에 긴 캡션을 넣는다. |
| 클라이언트 타임아웃 30초 | SDK 12초 × (1 + 재시도 1) + 지수 대기를 덮는다. 초상(60초)과 병렬이므로 전체 대기는 늘지 않는다. |
| Anthropic에 가는 것 | 프롬프트에 담긴 타입 코드·축 수치·언어뿐. 요청은 Worker가 보내므로 사용자 IP는 Anthropic에 가지 않는다. `metadata.user_id`도 쓰지 않는다. |

## 비용 어림

Haiku 5.5는 입력 $0.10 / 출력 $0.50 (MTok당, 프롬프트 100K 토큰 이하). 리딩 한 번은 입력 약 500~700 토큰, 출력(사고 포함) 약 200~500 토큰으로 **1회 $0.0003 안팎**, 1만 회에 $3 정도다. 속도 제한이 IP당 1분 5회라 남용 시 상한도 제한된다.

## 검증 계획

1. typecheck / lint / test / build 통과, `wrangler types` 재생성 후 `Env`에 `TEXT_PROVIDER`, `READING_LIMITER` 확인
2. 개발 서버(mock): `/api/config` → `features.reading: false`; `POST /api/reading` 고정 문구 200, 잘못된 축 400, 2KB 413, 교차 사이트 403, 6번째 429; 전체 흐름이 리딩 없이 결과 도달
3. `.dev.vars`에 `TEXT_PROVIDER=claude`, `ANTHROPIC_API_KEY=…`를 넣고 개발 서버에서 실제 호출 1회: ko/en 각각 3~4문장과 한 줄 캡션, 응답에 성별·나이 추정이 없는지 눈으로 확인, 결과 화면과 저장 이미지에 표시
4. 리뷰 뒤 `--no-ff` 병합, 브랜치 삭제
