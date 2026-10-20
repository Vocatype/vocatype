# 012 chore/vocatype — 설계 문서

## 목표

서비스 이름을 **Vocatype**으로 확정하고, 인프라 이름도 `vocatype`으로 통일한다.

| 대상 | 지금 | 변경 | 누가 |
| --- | --- | --- | --- |
| 화면 서비스 이름 `SERVICE_NAME` | VoicePortrait | Vocatype | 구현자 |

| `wrangler.jsonc` `name` | ai-voice-image-generator | vocatype | 구현자 |
| `package.json` `name` | ai-voice-image-generator | vocatype | 구현자 |
| Cloudflare Worker | ai-voice-analyser (대시보드 Git 연동으로 생성) | vocatype (새 Worker) | 구현자가 `wrangler deploy`로 생성, 사용자가 대시보드에서 Git 연결·구 Worker 삭제 |
| GitHub 저장소 | hyunseop827/ai-voice-analyser | hyunseop827/vocatype | 구현자 (`gh repo rename`, 리디렉션 유지) |
| 로컬 폴더 | ai-voice-image-generator | 유지 | 열려 있는 세션들이 이 경로를 쓰므로 바꾸지 않음. 원하면 사용자가 나중에 |

## 근거

- Cloudflare 문서: Git 연동 빌드는 **대시보드 Worker 이름과 Wrangler 설정의 `name`이 같아야** 하며 다르면 빌드가 실패한다. 현재는 다른데도 배포가 됐지만(007·008에서 확인) 문서상 보장되지 않으므로 맞춘다.
- Worker는 이름을 바꿀 수 없다. 새 Worker를 만들고 Git을 연결한 뒤 옛 Worker를 지운다. 기존 Worker에도 Settings → Builds에서 Git을 연결할 수 있다.
- 로컬에서 `wrangler deploy`로 먼저 만들면 바인딩(AI, 속도 제한, vars)이 설정 파일대로 생성되고, 사용자는 대시보드에서 Git 연결만 하면 된다.

## 절차

1. 브랜치에서 `wrangler.jsonc`·`package.json` 이름 변경, `wrangler types`, 검증 명령.
2. `npx wrangler deploy`(로컬, 로그인된 계정)로 `vocatype` Worker 생성 → `https://vocatype.hs827.workers.dev` 확인(`/api/config`, 전체 흐름).
3. `gh repo rename vocatype` → 원격 URL 자동 갱신 확인, main 푸시.
4. 사용자: 대시보드 → Workers → `vocatype` → Settings → Builds → Connect → `hyunseop827/vocatype` 선택(빌드 `npm run build`, 배포 기본값). 연결 후 옛 `ai-voice-analyser` Worker 삭제. 앤트로픽 키를 쓰면 `npx wrangler secret put ANTHROPIC_API_KEY --name vocatype` 재등록.
5. 병합·푸시 후 Git 빌드가 `vocatype`으로 배포되는지 `wrangler deployments list --name vocatype`로 확인.

## 검증 계획

- typecheck / lint / test / build, 출력 `wrangler.json`의 `name: vocatype`
- 새 주소에서 `/api/config`·`/api/health`, 브라우저 전체 흐름
- 저장소 이름 변경 뒤 `git remote -v`, `git push` 정상
