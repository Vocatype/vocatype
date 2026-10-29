# 033 chore/third-party-notices — 구현 문서

작업 브랜치: `claude/ai-model-migration-e64f72`(앱이 만든 worktree 브랜치). 병합할 때 `chore/033-third-party-notices` 를 만들어 `--no-ff` 로 병합한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `vite.config.ts` | 상수 `THIRD_PARTY_LICENSES_FILE = 'third-party-licenses.txt'`, `environments.client.build` 에 `license`, `rolldownOptions.output.comments.legal: true`, `postBanner`(처음에는 `banner`, 1차 리뷰 #2로 바꿈) |
| `README.md` | 라이선스 절에 `/third-party-licenses.txt` 안내 한 줄 |

## 확인한 사실

- Vite 8.3.4는 압축할 때 `comments.legal` 을 `!minify` 로 정한다(`node_modules/vite/dist/node/chunks/node.js` 34654~34659행). 그래서 원본의 `@license React` 머리 주석이 번들에서 빠졌다.
- Vite의 `vite:license` 플러그인은 각 청크의 모듈 ID 중 `node_modules` 에 있는 것만 골라, 가장 가까운 `package.json` 의 이름·버전·`license` 와 `LICENSE` 파일 원문을 모은다. 파일 이름이 `.json` 으로 끝나지 않으면 Markdown으로 낸다(같은 파일 34167~34244행. `\0` 가상 모듈은 건너뛴다 — 34186행).
- 런타임 패키지 11개(`package-lock.json`, dev 아님) 가운데 클라이언트 번들에 든 node_modules 패키지는 react 19.3.1, react-dom 19.3.1, scheduler 0.28.0(모두 MIT)뿐이다. 이 밖에 빌드 도구가 넣는 코드(Vite modulepreload 폴리필 약 670자, Rolldown `__commonJSMin` 헬퍼 약 81자, 둘 다 MIT)가 있으나 `\0` 가상 모듈이라 `vite:license` 가 건너뛴다. 도구가 생성하는 짧은 연결 코드라 고지 대상으로 보지 않았다(해석 불확실, 1차 리뷰 #1).
- 나머지 8개 중 Worker 번들에 든 것은 @anthropic-ai/sdk, @opentelemetry/api, fast-sha256, @stablelib/base64, standardwebhooks 5개다(`dist/worker` 의 `//#region node_modules/…` 로 확인). json-schema-to-ts 는 sdk가 타입으로만 쓰고 @babel/runtime·ts-algebra 는 그 의존성이라 어느 번들에도 없다(1차 리뷰 #3).

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

- 안내 주석을 `banner` 에서 `postBanner` 로 바꿨다(1차 리뷰 #2). `banner` 는 압축 전에 붙어 `comments.legal: true` 를 지우면 오류 없이 사라진다. 확인: `legal` 을 뺀 임시 설정으로 빌드하니 `postBanner` 주석은 1개 남고 `@license React` 는 0개가 됐다(설정은 원래대로 되돌림). 지금 설정의 출력 바이트는 `banner` 때와 같다(293,787바이트).

## 확인하지 못한 것

- 배포된 사이트의 `/third-party-licenses.txt` 응답. 정적 자산 설정이 SPA 폴백(`not_found_handling: single-page-application`)이라 파일이 없어도 200으로 `index.html` 이 나오므로, 배포 뒤 상태 코드가 아니라 **내용**(`# Licenses`)과 `content-type` 으로 확인한다.
- 빌드 산출물 검사는 단위 테스트에 넣지 않았다(전체 빌드가 필요하다). 위 확인은 수동이다.
- 법률 자문이 아니다. Worker 번들은 사용자에게 내려가지 않고(재배포가 아니다), `wrangler deploy` 로 Cloudflare에 올리는 것은 우리 대신 실행하는 호스팅 업체에 맡기는 것으로 보았다(해석 불확실).
