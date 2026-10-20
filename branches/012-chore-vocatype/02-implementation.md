# 012 chore/vocatype — 구현 문서

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `shared/config.ts` | `SERVICE_NAME = 'Vocatype'` — 로고, `<title>`, Worker 응답, 저장 파일명(`vocatype-<코드>.png`) |
| `wrangler.jsonc` | `name: "vocatype"` |
| `package.json`, `package-lock.json` | `name: "vocatype"` |
| `worker-configuration.d.ts` | `wrangler types` 재생성 |
| `README.md` | 제목 |
| `src/features/export/renderCard.test.ts` | 테스트 라벨의 서비스 이름 |

## 인프라 작업 (코드 밖)

| 작업 | 결과 |
| --- | --- |
| `npx wrangler deploy` (로컬, 로그인 계정) | 새 Worker `vocatype` 생성, 바인딩 AI·PORTRAIT_LIMITER·READING_LIMITER·vars(AI_PROVIDER, TEXT_PROVIDER) 그대로. 주소 `https://vocatype.hs827.workers.dev` |
| `gh repo rename vocatype` | GitHub 저장소 `hyunseop827/ai-voice-analyser` → `hyunseop827/vocatype`(비공개 유지, 옛 주소는 리디렉션). 로컬 원격 URL 자동 갱신 |
| 로컬 폴더 | `ai-voice-image-generator` 유지(열린 세션들이 이 경로를 씀) |

## 사용자가 할 일 (대시보드)

1. Workers & Pages → `vocatype` → Settings → Builds → **Connect** → `hyunseop827/vocatype` 선택. 빌드 명령 `npm run build`, 배포 명령 기본값. 설정 파일 `name`이 `vocatype`이라 대시보드 이름과 일치한다.
2. 옛 Worker `ai-voice-analyser` 삭제(Git 연동이 남아 있으면 푸시마다 이름 불일치로 빌드가 실패한다).
3. 앤트로픽 키를 쓰려면 새 Worker에 비밀값 등록: `npx wrangler secret put ANTHROPIC_API_KEY --name vocatype`(설정 이름이 같으므로 `--name` 생략 가능).

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| typecheck / lint / test(173) / build | 통과. 출력 `wrangler.json`의 `name: vocatype` |
| 새 주소 API | `/api/config` → `{"provider":"workers-ai","textProviders":["workers-ai"],"features":{"portrait":true,"reading":true}}`, `/api/health` → `service: "Vocatype"`, `<title>Vocatype</title>`, SPA 폴백 200 |
| 새 주소 전체 흐름 | 상단 바·제목 "Vocatype". 녹음(합성) → 생성 → 결과 도달. `/api/reading` 200(무료 할당량 소진으로 고정 문구 폴백, 카드 숨김), `/api/portrait` 503(할당량) → 자리표시 초상 |
| 옛 Worker | `ai-voice-analyser.hs827.workers.dev`가 아직 응답함 — 사용자가 삭제할 때까지 유지됨 |
