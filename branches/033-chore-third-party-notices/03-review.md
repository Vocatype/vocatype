# 033 chore/third-party-notices — 리뷰 문서

## 1차

- 검토자: 독립 리뷰 에이전트(새 컨텍스트). 저장소 파일은 바꾸지 않았다(`git status --porcelain` 0줄, HEAD `233eac3`). 비교 빌드·모듈 덤프·실험 파일은 세션 임시 폴더에만 두었다. 법률 자문이 아니며 해석이 갈리는 곳은 "해석 불확실"로 표시했다.
- 대상: `2703207`, `2ae9483`, `233eac3`(`git diff f98a44d..233eac3`)

### 체크리스트

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 원인(압축 시 legal 주석 제거) | 맞음 | `vite/dist/node/chunks/node.js:34654-34659`. 기준 빌드 JS에 `@license`·`/*!` 0건 |
| `environments.client.build` 병합 | 가정대로 | 최상위 `build` 가 기본값, `mergeConfig` 로 깊게 병합. Cloudflare 플러그인은 `outDir` 만 넣어 `dist/client` 유지 |
| `comments` 병합 | 맞음 | 압축 때 `{annotation:false, jsdoc:false, legal:true}`. 남은 블록 주석 6개(배너 1, `@license React` 5) |
| `build.license` 동작 | 맞음 | 기본값 false, 환경마다 `generateBundle`. `\0` 가상 모듈은 건너뜀(34186) → #1 |
| 클라이언트 청크·CSS | JS 1, CSS 1 | CSS는 자체 `global.css` 뿐 |
| 배너가 압축 뒤 남나 | 남음, 단 `legal: true` 에 기댐 | `banner` 는 압축 전에 붙는다 → #2 |
| 클라이언트 코드 변화 | 주석만 | legal 주석·개행을 빼면 기준 빌드와 같음 |
| 라이선스 파일 완전성 | node_modules 기준 완전 | react·react-dom·scheduler 원문 포함. 빌드 도구 생성 코드는 빠짐 → #1 |
| Worker 출력 영향 | 없음 | 기준·대상 `diff -r dist/worker` 는 `wrangler.json` 경로만 다름 |
| wrangler `.txt` 규칙 근거 | 정확 | 기본 규칙에 Text `**/*.txt`, `no_bundle: true` 라 `find_additional_modules` 기본 true |
| 서빙(`npm run preview`) | 통과 | `/third-party-licenses.txt` → 200 `text/plain; charset=utf-8`, 3,429바이트, `dist` 와 `cmp` 같음. 없는 `.txt` 는 200 `text/html`(SPA 폴백) — 02의 "내용으로 확인" 주의가 맞음 |
| 개인정보 | 통과 | 새 요청 없음 |
| 02 수치 | 맞음 | 3,429B, 293,787B(기준 292,561B에서 +1,226B), `@license React` 5개, 38파일 317건 |

### 발견 사항과 조치

| 번호 | 심각도 | 내용 | 조치 |
| --- | --- | --- | --- |
| 1 | 중간(법적 판단은 해석 불확실) | "클라이언트 번들에 든 것은 react, react-dom, scheduler뿐"이 사실과 다르다. Vite modulepreload 폴리필(약 670자, MIT)과 Rolldown `__commonJSMin` 헬퍼(약 81자, MIT)가 들어 있고, `\0` 가상 모듈이라 라이선스 파일에 없다 | 수정(권장안 a): 01·02·README·`vite.config.ts` 주석에서 범위를 "node_modules 의존성 패키지"로 밝히고, 도구가 생성하는 1 kB 미만 연결 코드는 고지 대상으로 보지 않았다는 판단을 "해석 불확실"과 함께 기록 |
| 2 | 낮음 | `banner` 는 압축 전에 붙어 `comments.legal: true` 를 지우면 오류 없이 사라진다 | 수정: `postBanner` 로 바꿈. 구현자가 `legal` 을 뺀 임시 빌드로 배너 1개가 남는 것을 확인하고 원복 |
| 3 | 낮음 | "나머지 8개는 Worker 쪽"이 틀림. Worker 번들에 든 것은 @anthropic-ai/sdk, @opentelemetry/api, fast-sha256, @stablelib/base64, standardwebhooks 5개이고, 3개는 타입 전용 | 수정: 01 표·02. 구현자가 `dist/worker` 의 `//#region node_modules/…` 로 5개 확인 |
| 4 | 낮음(해석 불확실) | "Worker 번들은 배포 대상이 아니다"가 `npm run deploy` 와 부딪혀 읽힘 | 수정: "사용자에게 내려가지 않는다(재배포가 아니다). Cloudflare에 올리는 것은 호스팅 업체에 맡기는 것으로 보았다(해석 불확실)"(01·02) |
| 5 | 참고(해석 불확실) | "고지 의무는 … 충족된다"가 단정 | 수정: "충족된다고 보았다(webpack `LICENSE.txt` 와 같은 관행, 해석 불확실)" |
| 6 | 참고 | 02의 행 범위가 LICENSE 파일 찾기와 `\0` 제외를 빠뜨림 | 수정: 34167~34244행, 34186행 명시 |
| 7 | 참고 | 패키지 이름을 박아 두어 의존성이 바뀌면 낡는다 | 수정: README·`vite.config.ts` 에 "(지금은 …)" |

### 검토자가 직접 실행한 검사

| 명령 | 종료 코드 |
| --- | --- |
| `npm run typecheck` / `lint` / `test`(38파일 317건) / `rm -rf dist && npm run build` | 모두 0 |
| 기준·대상 `git archive` 빌드 후 `diff -r dist/worker`, 모듈 ID 덤프, banner·postBanner 실험 | 모두 0 |
| `npm run preview` + curl, 뒤에 서버 정지 | 정상 |

### 1차 결론

**수정 필요.** 설정은 의도대로 동작한다(클라이언트만, `text/plain` 서빙, 주석·배너 유지, Worker 출력 그대로). 핵심 주장인 클라이언트 번들 구성 서술이 부정확하다(#1). #3·#4와 #2(`postBanner`)를 함께 고친다.

### 1차 반영 뒤 구현자 검사

| 명령 | 결과 |
| --- | --- |
| `npm run typecheck` / `lint` / `build` | 종료 코드 0 |
| `npm test` | 38파일 317건 |
| 빌드 산출물 | JS 첫 줄 배너, `@license React` 5개, `third-party-licenses.txt` 3,429바이트, Worker 쪽 라이선스 파일 0개, JS 293,787바이트(banner 때와 같음) |
| `legal` 을 뺀 임시 빌드 | 배너 1개 남음, `@license React` 0개 → 원복 |
| `git diff --check` | 공백 문제 없음 |
