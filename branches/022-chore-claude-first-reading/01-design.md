# 022 chore/claude-first-reading — 설계 문서

## 변경 사유

사용자 결정(2026-10-20): 목소리 리딩 체인 순서를 `workers-ai,claude`에서 **`claude,workers-ai`** 로 바꾼다.
010에서 정한 "최대한 무료를 쓰되, 안 되면 Anthropic API 키를 쓴다" 원칙을 "Claude로 쓰고, 실패하면 무료 Workers AI로 받친다"로 바꾸는 것이다.

근거는 다음과 같다.

| 항목 | 내용 |
| --- | --- |
| 품질 일관성 | 초상 1장이 약 1,400~1,500뉴런이라 무료 할당량(하루 10,000뉴런)은 하루 6~7장에서 소진된다. 그 뒤 리딩은 `4006`으로 Claude가 답한다. 지금은 같은 서비스에서 하루 이른 시간 사용자는 Llama 4 Scout, 나머지는 Claude Haiku 5.5 문장을 받는다. 순서를 바꾸면 모든 사용자가 같은 모델의 문장을 받는다. |
| 한국어 문장 | 011 실측에서 Scout는 규칙(문장 수·금지어·길이)은 지켰지만 수식이 단순하고 해요체·네요체가 섞였다. Claude는 009 실측(ko 1회, en 1회, 출력 규칙 점검 기록)에서 해요체, "당신" 없음, 성별·나이 표현·숫자 인용 0건이었다. 표본이 작으므로 배포 후 확인에서 한 번 더 본다. |
| 비용 | Haiku 5.5는 입력 $0.10 / 출력 $0.50 (100만 토큰당). 실측 1회 입력 약 1,200, 출력 160~264토큰으로 **약 $0.0002**, 1,000회에 약 $0.2다. |
| 이미지 할당량 | **거의 영향 없다.** 리딩 1회는 약 25뉴런으로 초상 1장의 약 1/60이다. 리딩을 Workers AI에서 모두 빼도 하루 초상 6~7장 한도는 그대로다. 이 변경의 목적은 할당량이 아니라 문장 품질의 일관성이다. |

## 범위

### 포함

- `wrangler.jsonc`: `vars.TEXT_PROVIDER` `"workers-ai,claude"` → `"claude,workers-ai"`, 위쪽 설정 주석 갱신
- `worker-configuration.d.ts`: `wrangler types` 재생성(`TEXT_PROVIDER` 리터럴 타입). 로컬 `.dev.vars`가 타입을 넓히면 011처럼 깨끗한 출력으로 복원
- `README.md`: 기술 스택 표의 AI 줄, 텍스트 제공자 절의 원칙 문장·체인 그림·설정 표(현재 값 표시)·"체인에 Claude 추가하기" 단계, 비용 절의 "소진 뒤 Claude로 넘어간다" 문장
- `shared/api.ts`: `TextProviderName` 주석의 고정 순서(`workers-ai → claude → mock`)를 설정 순서 기준 서술로
- `worker/index.test.ts`: 운영 순서(claude → workers-ai)의 라우트 테스트 두 건
  - claude가 실패하면 workers-ai가 답하고 `provider: "workers-ai"`, 로그에 `[reading] claude failed, falling back`
  - claude가 성공하면 Workers AI(`AI.run`)는 부르지 않는다

### 제외

- 체인·제공자 코드(`worker/ai/textChain.ts`, `worker/ai/claude.ts`) 변경 없음. 진행 중인 020(contract-cleanup)이 타임아웃 상수를 정리하고 있어 겹치지 않게 한다
- 모델 변경 없음(Claude `claude-haiku-5-5`, Workers AI `@cf/meta/llama-4-scout-17b-16e-instruct`)
- 초상 제공자 변경 없음
- `branches/` 아래 지난 문서는 당시 기록이므로 고치지 않는다

## 바뀐 뒤 동작

```
claude (Haiku 5.5, 키가 있을 때) ──실패──▶ workers-ai (Llama 4 Scout, 무료) ──실패──▶ mock 고정 문구 (화면에는 안 보임)
```

- `GET /api/config` → `textProviders: ["claude","workers-ai"]`
- 키가 없으면 claude는 조용히 빠져 지금처럼 workers-ai만 남는다(코드 변경 없음, 010 규칙)
- 클라이언트는 바뀌지 않는다. 어느 제공자가 답했든 `provider`가 `mock`이 아니면 같은 방식으로 보여 준다

## 시간 예산과 폴백의 한계

체인 전체 예산은 25초이고, 다음 제공자에 3초보다 적게 남으면 건너뛴다(`textChain.ts`). Claude는 체인이 준 남은 예산 신호를 쓰고, SDK는 요청 1회 12초·재시도 1회다.

| Claude 실패 형태 | 예 | 결과 |
| --- | --- | --- |
| 빠른 실패 | 키 오류 401, 400, 거부(`refusal`), 출력 잘림, JSON·길이 위반, 짧은 대기 뒤 재시도도 실패한 5xx | 남은 예산으로 workers-ai가 답한다 |
| 느린 실패 | 12초 타임아웃 2회(약 24초), `retry-after`가 긴 429·529 | 예산을 거의 다 써서 workers-ai를 건너뛰고 mock → 화면은 카탈로그 설명 |

즉 Claude 장애가 "느린" 형태면 Llama 예비가 작동하지 않는다. 지금 순서에서도 앞 제공자가 오래 끌면 뒤 제공자를 건너뛰는 같은 구조였다(011 "알려진 한계"). 고치려면 앞 제공자에 자기 몫 예산 상한(예: 남은 예산에서 뒤 제공자 몫을 뺀 값)을 주는 코드 변경이 필요하므로 이 작업에서는 기록만 하고 후속 작업 후보로 둔다(020의 타임아웃 정리 뒤).

## 비용 상한과 되돌리기

- 이제 모든 리딩이 Claude로 나간다. 1회 약 $0.0002.
- 남용 최악(011 계산): `READING_LIMITER`가 접속 IP당 1분 5회(콜로별)라 한 IP가 쉬지 않고 채우면 7,200회/일 ≈ $1.44~1.8/일. 상한 자체는 순서와 무관하지만, 이제 첫 요청부터 Claude라 실제로 그 상한에 닿을 수 있다.
- 권장(사용자 작업): Anthropic 콘솔에서 이 키의 월 지출 한도를 둔다.
- 되돌리기: `vars.TEXT_PROVIDER`를 `"workers-ai,claude"`로 되돌려 배포(설정 한 줄).

## 개인정보

- 보내는 데이터는 바뀌지 않는다: 타입 코드, 여섯 축 수치(소수 둘째 자리), 언어. 요청은 Worker가 보내므로 사용자 IP는 Anthropic에 가지 않는다.
- 달라지는 것은 빈도다. 전에는 할당량 소진 뒤에만 Anthropic으로 갔고, 이제는 모든 리딩이 간다. README의 "보내는 데이터와 비용" 절은 이미 Anthropic 전송과 데이터 정책을 적고 있으므로 문장이 새 순서와 맞는지만 점검한다.

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| `claude`만이 아니라 `claude,workers-ai` | Claude의 빠른 실패(키·거부·형식) 때 무료 모델이 받친다. Workers AI는 Claude가 실패할 때만 호출되므로 평소 비용·할당량이 들지 않는다. |
| 코드 변경 없이 설정만 | 010이 체인 순서를 설정 목록 순서로 만들어 두었다. 순서 테스트(`buildTextChain`의 `claude,workers-ai` 행)도 이미 있다. |
| 운영 순서의 라우트 테스트 추가 | 지금 라우트 테스트는 모두 `workers-ai,claude` 순서다. 실제 운영 경로(Claude 실패 → Workers AI)를 라우트 수준에서 한 번 고정해 둔다. |
| 시간 예산 한계는 기록만 | 고치려면 체인 코드를 바꿔야 하고, 020이 같은 파일의 타임아웃을 정리 중이다. |

## 검증 계획

1. `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` 종료 코드 0. `dist/worker/wrangler.json`의 `vars.TEXT_PROVIDER`가 `"claude,workers-ai"`
2. 구현자 확인(빌드본, workerd): `npx wrangler dev -c dist/worker/wrangler.json --port 8788 --var ANTHROPIC_API_KEY:<가짜 키>`
   - `GET /api/config` → `textProviders: ["claude","workers-ai"]`
   - `POST /api/reading` ko 1회 → Claude 401(가짜 키, 재시도 없음) → workers-ai가 답해 `provider: "workers-ai"`. 로그 `[reading] claude failed, falling back: … 401`. 실제 Workers AI 1회(약 25뉴런)를 쓴다
3. 독립 리뷰 1차 → 반영 → 2차 → "병합 가능"이면 `--no-ff` 병합, 브랜치 삭제
4. **배포는 사용자 확인 뒤.** 확인 뒤 푸시·배포하고 배포 주소에서
   - `GET /api/config` → `textProviders: ["claude","workers-ai"]`
   - `POST /api/reading` ko 1회 → 200, `provider: "claude"`(약 $0.0002)
   - 결과를 02 문서 "배포 후 확인" 절에 기록
