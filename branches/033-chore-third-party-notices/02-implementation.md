# 033 chore/third-party-notices — 구현 문서

작업 브랜치: `claude/ai-model-migration-e64f72`(앱이 만든 worktree 브랜치). 병합할 때 `chore/033-third-party-notices` 를 만들어 `--no-ff` 로 병합한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `vite.config.ts` | 상수 `THIRD_PARTY_LICENSES_FILE = 'third-party-licenses.txt'`, `environments.client.build` 에 `license`, `rolldownOptions.output.comments.legal: true`, `banner` |
| `README.md` | 라이선스 절에 `/third-party-licenses.txt` 안내 한 줄 |

## 확인한 사실

- Vite 8.3.4는 압축할 때 `comments.legal` 을 `!minify` 로 정한다(`node_modules/vite/dist/node/chunks/node.js` 34654~34659행). 그래서 원본의 `@license React` 머리 주석이 번들에서 빠졌다.
- Vite의 `vite:license` 플러그인은 각 청크의 모듈 ID 중 `node_modules` 에 있는 것만 골라, 가장 가까운 `package.json` 의 이름·버전·`license` 와 `LICENSE` 파일 원문을 모은다. 파일 이름이 `.json` 으로 끝나지 않으면 Markdown으로 낸다(같은 파일 34174~34239행).
- 런타임 패키지 11개(`package-lock.json`, dev 아님) 가운데 클라이언트 번들에 든 것은 react 19.3.1, react-dom 19.3.1, scheduler 0.28.0(모두 MIT)뿐이다. 나머지 8개는 Worker 쪽이다.

## 검증 결과

`npm run build` 뒤:

| 확인 | 결과 |
| --- | --- |
| `dist/client/third-party-licenses.txt` | 3,429바이트. `## react-dom - 19.3.1 (MIT)`, `## react - 19.3.1 (MIT)`, `## scheduler - 0.28.0 (MIT)` 와 각 MIT 원문(Copyright (c) Meta Platforms, Inc. and affiliates. + 허락 문구 전문) |
| JS 첫 줄 | `/*! Third-party licenses: /third-party-licenses.txt */` |
| 남은 `@license React` 주석 | 5개(react·react-dom·scheduler의 production 파일 머리) |
| Worker 출력 | 라이선스 파일 없음(`find dist/worker -iname "*licen*"` 0건) |
| 클라이언트 JS 크기 | 293,787바이트. 바꾸기 전 빌드 표시 292.56 kB에서 약 1.2 kB 늘었다(주석과 배너) |

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` / `lint` / `build` | 종료 코드 0 |
| `npm test` | 38파일 317건 통과 |
| `git diff --check` | 공백 문제 없음 |

## 설계 대비 달라진 점

없음.

## 확인하지 못한 것

- 배포된 사이트의 `/third-party-licenses.txt` 응답. 정적 자산 설정이 SPA 폴백(`not_found_handling: single-page-application`)이라 파일이 없어도 200으로 `index.html` 이 나오므로, 배포 뒤 상태 코드가 아니라 **내용**(`# Licenses`)과 `content-type` 으로 확인한다.
- 빌드 산출물 검사는 단위 테스트에 넣지 않았다(전체 빌드가 필요하다). 위 확인은 수동이다.
- 법률 자문이 아니다. 서버에서만 도는 Worker 번들은 배포가 아니라고 보았다.
