# 033 chore/third-party-notices — 리뷰 문서

## 1차

- 검토자: 독립 리뷰 에이전트(새 컨텍스트). 저장소 파일은 바꾸지 않았다(`git status --porcelain` 0줄, HEAD `233eac3`). 작업 트리의 `dist/` 는 빌드·preview로 다시 만들어졌다(gitignore 대상, 내용 같음). 비교 빌드·모듈 덤프·실험 파일은 세션 임시 폴더에만 두었다. 법률 자문이 아니며 해석이 갈리는 곳은 "해석 불확실"로 표시했다.
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
| 라이선스 파일 완전성 | node_modules 기준으로 완전, 번들 전체 기준으로는 아님 | react·react-dom·scheduler 원문 포함. 빌드 도구 생성 코드는 빠짐 → #1 |
| Worker 출력 영향 | 없음 | 기준·대상 `diff -r dist/worker` 는 `wrangler.json` 경로만 다름 |
| Worker 제외 논리 | 대체로 타당(해석 불확실) | #4 |
| wrangler `.txt` 규칙 근거 | 정확 | 기본 규칙에 Text `**/*.txt`, `no_bundle: true` 라 `find_additional_modules` 기본 true |
| 서빙(`npm run preview`) | 통과 | `/third-party-licenses.txt` → 200 `text/plain; charset=utf-8`, 3,429바이트, `dist` 와 `cmp` 같음. 없는 `.txt` 는 200 `text/html`(SPA 폴백) — 02의 "내용으로 확인" 주의가 맞음 |
| 개인정보 | 통과 | 새 요청 없음 |
| 02 수치 | 맞음 | 3,429B, 293,787B(기준 292,561B에서 +1,226B), `@license React` 5개, 38파일 317건 |
| 02 서술 | 일부 틀림 | #1(클라이언트 "뿐이다"), #3("나머지 8개는 Worker"), #6(행 범위) |
| README | 일부 부정확 | #1, #7 |
| 브랜치·커밋 규칙 | 통과 | 폴더 `branches/033-chore-third-party-notices/`, 병합 브랜치 `chore/033-third-party-notices`, Conventional Commits |

### 발견 사항과 조치

| 번호 | 심각도 | 내용 | 조치 |
| --- | --- | --- | --- |
| 1 | 중간(법적 판단은 해석 불확실) | "클라이언트 번들에 든 것은 react, react-dom, scheduler뿐"이 사실과 다르다. Vite modulepreload 폴리필(약 670자, MIT)과 Rolldown `__commonJSMin` 헬퍼(약 81자, MIT)가 들어 있고, `\0` 가상 모듈이라 라이선스 파일에 없다 | 수정(권장안 a): 01·02·README·`vite.config.ts` 주석에서 범위를 "node_modules 의존성 패키지"로 밝히고, 도구가 생성하는 1 kB 미만 연결 코드는 고지 대상으로 보지 않았다는 판단을 "해석 불확실"과 함께 기록 |
| 2 | 낮음 | `banner` 는 압축 전에 붙어 `comments.legal: true` 를 지우면 오류 없이 사라진다 | 수정: `postBanner` 로 바꿈. 구현자가 `legal` 을 뺀 임시 빌드로 배너 1개가 남는 것을 확인하고 원복 |
| 3 | 낮음 | "나머지 8개는 Worker 쪽"이 틀림. Worker 번들에 든 것은 @anthropic-ai/sdk, @opentelemetry/api, fast-sha256, @stablelib/base64, standardwebhooks 5개이고, 3개는 타입 전용 | 수정: 01 표·02. 구현자가 `dist/worker` 의 `//#region node_modules/…` 로 5개 확인 |
| 4 | 낮음(해석 불확실) | "Worker 번들은 배포 대상이 아니다"가 `npm run deploy` 와 부딪혀 읽힘 | 수정: "사용자에게 내려가지 않는다(재배포가 아니다). Cloudflare에 올리는 것은 호스팅 업체에 맡기는 것으로 보았다(해석 불확실)"(01·02) |
| 5 | 참고(해석 불확실) | "고지 의무는 … 충족된다"가 단정 | 수정: "충족된다고 보았다(webpack `LICENSE.txt` 와 같은 관행, 해석 불확실)". 배너에 MIT 원문 한 벌(1,087B)을 넣는 선택안은 쓰지 않음 |
| 6 | 참고 | 02의 행 범위가 LICENSE 파일 찾기와 `\0` 제외를 빠뜨림 | 수정: 34167~34244행, 34186행 명시. "가장 가까운 package.json"(정확히는 `name` 이 있는 패키지 루트, `findNearestMainPackageData`) 표현은 그대로 둠 |
| 7 | 참고 | 패키지 이름을 박아 두어 의존성이 바뀌면 낡는다 | 수정: README·`vite.config.ts` 에 "(지금은 …)" |

### 검토자가 직접 실행한 검사

| 명령 | 종료 코드 |
| --- | --- |
| `npm run typecheck` / `lint` / `test`(38파일 317건) / `rm -rf dist && npm run build` | 모두 0 |
| 기준·대상 `git archive` 빌드 후 `diff -r dist/worker`, 모듈 ID 덤프, banner·postBanner 실험 | 모두 0 |
| `git diff --check f98a44d..233eac3` | 0 |
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

## 2차

- 검토자: 1차와 같은 독립 리뷰 에이전트. 저장소 파일은 바꾸지 않았다(`git status --porcelain` 0줄, HEAD `013b426`). `dist/` 만 다시 만들어졌다(내용은 1차와 같다).
- 대상: `a388837`, `013b426`(`git diff 233eac3..HEAD`)

### 체크리스트

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| #1 번들 구성 서술 | 해결 | 01 표·제외 목록, 02, README "의존성 패키지", `vite.config.ts` 주석. 수치와 34186행 근거가 1차 측정과 맞음 |
| #2 `postBanner` | 해결 | `legal` 을 뺀 HEAD 설정 빌드에서 배너 1, `@license React` 0 |
| #3 Worker 패키지 | 해결(표현 → #10) | 5개 목록이 1차 집계와 맞음 |
| #4·#5·#6·#7 | 해결 | "해석 불확실" 표기, 행 범위, "(지금은 …)" |
| 출력 바이트·해시 | 1차와 같음 | HEAD 빌드의 JS(293,787B)·라이선스 파일(3,429B)·`index.html` 이 `233eac3` 빌드와 `cmp` 같음 |
| `postBanner` 와 해시 | 문제없음 | 배너 문구만 바꾼 임시 빌드에서 파일명이 바뀜 → 해시가 최종 내용으로 정해짐 |
| 캐시 | 문제없음 | preview에서 JS·라이선스 파일 모두 `cache-control: public, max-age=0, must-revalidate` + ETag(운영 헤더는 배포 뒤 확인) |
| 소스맵(지금은 꺼짐) | 영향 없음 | `build.sourcemap: true` 임시 빌드에서 banner·postBanner의 `mappings` 같음 |
| Worker 출력 | 영향 없음 | 기준과 `wrangler.json` 경로만 다름, 라이선스 파일 0 |
| 서빙(`npm run preview`) | 통과 | `/third-party-licenses.txt` → 200 `text/plain; charset=utf-8`, `cmp` 같음 |
| 03의 1차 기록 | 대체로 충실, 일부 누락 | #8, #9 |

### 발견 사항과 조치

| 번호 | 심각도 | 내용 | 조치 |
| --- | --- | --- | --- |
| 8 | 낮음 | 03 1차 체크리스트에서 통과가 아니던 행 3개(Worker 제외 논리, 02 서술, README)와 브랜치·커밋 행이 빠졌고, 완전성 행의 "번들 전체 기준으로는 아님"이 빠짐 | 수정: 행 되살림, 완전성 결과 정정 |
| 9 | 참고 | 1차 기록의 작은 누락(`dist/` 재생성, `git diff --check`, #5 선택안 미채택, #6 package.json 표현 보류) | 수정: 한 줄씩 덧붙임 |
| 10 | 참고 | "타입 전용"이 느슨함(json-schema-to-ts 는 sdk가 타입으로만 쓰고, 나머지 둘은 그 의존성) | 수정: 01·02 표현 정정 |

### 검토자가 직접 실행한 검사

| 명령 | 종료 코드 |
| --- | --- |
| `npm run typecheck` / `lint` / `test`(38파일 317건) / `rm -rf dist && npm run build` | 모두 0 |
| HEAD·`233eac3` 빌드 `cmp`, postBanner 문구 변경·`legal` 제거·sourcemap 임시 빌드, `diff -r dist/worker` | 모두 0 |
| `npm run preview` + curl, 뒤에 서버 정지 | 정상 |
| `git diff --check 233eac3..HEAD` | 0 |

### 2차 결론

**병합 가능.** 1차 #1~#7이 모두 맞게 반영됐고 출력 바이트·해시는 banner 때와 같다. #8~#10은 문서만 고치면 되는 것이라 병합 전에 반영했다. 병합은 `chore/033-third-party-notices` 를 만들어 `--no-ff` 로 하고, 배포 뒤 `/third-party-licenses.txt` 의 내용과 `content-type` 을 확인한다.
