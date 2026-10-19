# 006 feature/ai-adapter — 설계 문서

## 목표

AI 제공자를 어댑터로 분리해, 지금은 모의(mock) 제공자로 전체 흐름이 돌고, 설정 하나(`AI_PROVIDER=workers-ai`)만 바꾸면 Cloudflare Workers AI가 실사 초상을 생성하게 한다.
클라이언트는 초상 생성에 **타입 코드와 씨앗만** 보낸다. 음성은 어떤 경우에도 서버로 가지 않는다.

## 범위

### 포함

- `shared/api.ts`: 클라이언트·Worker 공용 API 계약 타입 (`/api/config`, `/api/portrait`)
- `worker/ai/types.ts`: `AiProvider` 인터페이스
- `worker/ai/mock.ts`: 이미지 없음(`null`)을 돌려주는 모의 제공자
- `worker/ai/workersAi.ts`: `@cf/black-forest-labs/flux-1-schnell`로 초상 생성 (base64 → data URL)
- `worker/ai/select.ts`: `env.AI_PROVIDER`와 `env.AI` 바인딩 유무로 제공자 선택
- `worker/index.ts`: `GET /api/config`, `POST /api/portrait`(요청 검증, 크기 제한, 오류 응답), 기존 `/api/health`
- `wrangler.jsonc`: `ai` 바인딩, `vars.AI_PROVIDER = "mock"`; `worker-configuration.d.ts` 재생성
- `src/features/ai/client.ts`: 설정 조회(세션 내 1회 캐시), 초상 요청(타임아웃, 실패 시 `null`)
- `src/screens/GeneratingScreen.tsx`: 분석 뒤 초상 단계 추가(설정이 켜져 있을 때만), 실패해도 결과로 진행
- `src/App.tsx`: `portrait` 상태를 결과 화면에 전달
- README: 제공자 켜는 방법, 비용·개인정보 안내
- 단위 테스트: 요청 검증, 제공자 선택, 모의 제공자, 클라이언트 실패 처리

### 제외

- 음성 인식(Whisper)으로 스크립트 일치율 계산. 음성을 서버로 보내야 하므로 개인정보 원칙상 기본 설계에서 뺀다. 필요하면 별도 작업에서 "전송하되 저장하지 않음"을 명시하고 옵트인으로 추가한다.
- 이미지 캐시·저장. 생성된 이미지는 응답으로만 돌아가고 서버에 남지 않는다.

## API 계약

```
GET  /api/config   → 200 { provider: 'mock' | 'workers-ai', features: { portrait: boolean } }
POST /api/portrait { typeCode: 'WFQV', seed: 123456 }
                   → 200 { image: 'data:image/jpeg;base64,…' | null, provider }
                   → 400 { error: 'invalid_request' }   잘못된 코드·씨앗
                   → 413 { error: 'too_large' }         본문 1KB 초과
                   → 503 { error: 'provider_failed' }   제공자 오류 (클라이언트는 null로 처리)
```

프롬프트는 서버가 `buildPortraitPrompt(typeCode)`로 만든다. 클라이언트가 임의 프롬프트를 보낼 수 없어 엔드포인트를 범용 이미지 생성기로 악용할 수 없다.

## 흐름

```
GeneratingScreen
  ├─ analyzeRecording()                    (004, 기기 안)
  ├─ fetchAiConfig()  ── features.portrait=false ──▶ onAnalyzed({ profile, portrait: null })
  └─ requestPortrait({ typeCode, seed }) ──▶ 성공: data URL / 실패·타임아웃: null ──▶ onAnalyzed(...)
```

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| Workers AI를 1순위 제공자로 | 같은 플랫폼이라 키 관리가 없고 바인딩만 추가하면 된다. Flux schnell은 4스텝에 수 초, 비용은 장당 1센트 미만. |
| 제공자 선택을 환경 변수로 | 코드 변경 없이 대시보드나 `wrangler.jsonc`에서 전환. 바인딩이 없으면 자동으로 mock. |
| 씨앗을 특징 해시로 | 같은 녹음이면 같은 얼굴. 서버는 씨앗을 그대로 모델에 넘긴다. |
| 실패하면 결과로 진행 | 초상은 결과의 일부일 뿐이다. 제공자 장애가 전체 흐름을 막지 않게 하고, 자리표시 초상으로 대체한다. |
| 프롬프트에 성별·나이·인종 없음 | "임의의 얼굴"이 목표이며 사용자 정보를 추정하지 않는다. 모델이 자유롭게 생성한다. |
| 타임아웃 60초 | Flux schnell은 보통 10초 안에 끝난다. 그 이상은 장애로 보고 null 처리. |

## 검증 계획

1. typecheck / lint / test / build 통과, `wrangler types` 재생성 후 `Env`에 `AI`, `AI_PROVIDER` 확인
2. 개발 서버(mock): `/api/config` → `{ provider: 'mock', features: { portrait: false } }`, 전체 흐름에서 초상 단계를 건너뛰고 결과 도달
3. `POST /api/portrait` 검증: 잘못된 코드 400, 큰 본문 413, mock에서 `image: null`
4. Workers AI 실제 호출은 Cloudflare 계정 로그인이 필요해 이 작업에서는 코드 경로와 타입만 검증하고, 배포 후 확인 절차를 README에 적는다
