# 007 chore/enable-workers-ai — 설계 문서

## 목표

배포 환경의 AI 제공자를 모의(mock)에서 Cloudflare Workers AI로 전환해 실사 초상이 생성되게 한다.

## 범위

- `wrangler.jsonc`의 `vars.AI_PROVIDER`를 `"mock"` → `"workers-ai"`
- `worker-configuration.d.ts` 재생성(`Env.AI_PROVIDER` 리터럴 타입 변경)
- 코드 변경 없음. 006의 어댑터·속도 제한·교차 사이트 차단이 그대로 적용된다.

## 영향

- 푸시 후 Cloudflare Workers Builds가 재배포하면 `/api/config`가 `features.portrait: true`를 돌려주고, 생성 화면에 "초상을 그리는 중" 단계가 추가된다.
- Workers AI 과금이 시작된다(Flux 1 schnell, 4스텝). IP당 1분 5회 제한이 상한을 잡는다.
- 사용자 데이터 흐름은 변하지 않는다. 서버로 가는 것은 타입 코드와 씨앗뿐이다.

## 검증 계획

1. typecheck / lint / test / build 통과
2. 배포 후 `GET /api/config` → `{"provider":"workers-ai","features":{"portrait":true}}`
3. 배포 후 브라우저 전체 흐름에서 실사 초상 표시, 같은 `{typeCode, seed}` 2회 호출의 이미지 해시 비교(seed 결정성)
