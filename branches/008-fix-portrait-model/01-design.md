# 008 fix/portrait-model — 설계 문서

## 배경

007에서 `AI_PROVIDER=workers-ai`로 전환한 뒤 배포 주소에서 `/api/portrait`가 모두 503으로 돌아왔다.
로컬에서 `.dev.vars`로 재현해 Worker 로그를 보니 두 가지 원인이 있었다.

1. `@cf/black-forest-labs/flux-1-schnell`이 `seed` 입력을 거부한다: `AiError 5006: Additional or unevaluated properties '/seed' at '/' not allowed`. 006 리뷰에서 "seed 지원 미확인"으로 남겨 둔 항목이 실제로 미지원이었다.
2. 계정의 Workers AI 무료 일일 할당량 소진: `AiError 4006: you have used up your daily free allocation of 10,000 neurons`.

## 목표

- 같은 녹음이면 같은 얼굴이 나오도록 `seed`를 받는 실사 지향 모델로 바꾼다.
- 제공자 실패 원인을 운영에서 알 수 있도록 오류 종류·메시지만 로그에 남긴다(사용자 데이터 없음).

## 결정

| 결정 | 근거 |
| --- | --- |
| 모델을 `@cf/leonardo/lucid-origin`으로 | 생성 타입 기준 `seed`·`width`·`height`를 받고 출력이 `{ image: base64 }`로 Flux와 같아 코드 변경이 작다. Leonardo 모델은 실사 품질이 강점이다. 같은 입력 스키마를 가진 `phoenix-1.0`도 후보다. |
| 768×768 정사각 | 결과 카드가 1:1로 쓴다. 기본 1024보다 비용·시간이 적다. |
| base64 매직 바이트로 MIME 판별 | 모델마다 JPEG/PNG가 다를 수 있어 data URL 접두사를 고정하지 않는다. |
| `console.error`로 오류 종류·메시지만 기록 | 503만 보고는 원인을 알 수 없었다. 응답에는 여전히 세부를 노출하지 않는다. |

## 검증 계획

1. typecheck / lint / test / build 통과
2. 로컬(`.dev.vars`)에서 실제 모델 호출: 같은 씨앗 2회 → 같은 해시, 다른 씨앗 → 다른 해시
3. 배포 후 같은 확인. 무료 할당량이 소진된 상태면 할당량 초기화(일 단위) 또는 Workers Paid 전환 뒤 확인
