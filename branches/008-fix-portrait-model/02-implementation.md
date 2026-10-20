# 008 fix/portrait-model — 구현 문서

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `worker/ai/workersAi.ts` | 모델 `@cf/leonardo/lucid-origin`, `seed`·768×768 입력, `detectImageMime`(JPEG/PNG/WebP) |
| `worker/ai/workersAi.test.ts` | 호출 인자, MIME별 data URL, 빈·알 수 없는 응답 |
| `worker/index.ts` | 제공자 실패 시 `console.error('[portrait] provider failed:', name: message)` — 응답은 그대로 503 |
| `worker/index.test.ts` | 기대 data URL을 JPEG 매직 바이트 기준으로 |

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| typecheck / lint / test(122) / build | 통과 |
| 로컬 재현 (Flux + seed) | `AiError 5006: Additional or unevaluated properties '/seed'` — 원인 확정 |
| 로컬 실호출 (Lucid Origin) | `AiError 4006: daily free allocation of 10,000 neurons` — 계정 무료 할당량 소진으로 생성 자체가 막혀 결정성 검증 불가. 할당량 초기화 후 또는 Workers Paid 전환 후 재확인 필요 |
| 배포 사이트 전체 흐름 (`https://ai-voice-analyser.hs827.workers.dev`, 007 배포본) | 메인 → 녹음(합성 스트림) → 생성: `/api/config` 200(`workers-ai`, `portrait: true`) → "초상을 그리는 중" 단계 → `/api/portrait` 503 → 결과 화면에 자리표시 초상으로 정상 도달. `localStorage`·쿠키 없음, 언어 자동 감지(ko). 실패가 흐름을 막지 않음 |
