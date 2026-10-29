# 033 chore/third-party-notices — 설계 문서

## 변경 사유

032 라이선스 리뷰(1차 #10)에서 나온 기존 문제다. 배포되는 클라이언트 번들(`dist/client/assets/index-*.js`)에 React의 MIT 고지가 없다. MIT는 "모든 사본 또는 상당 부분에" 저작권 고지와 허락 문구를 넣으라고 요구한다. 사용자가 2026-10-29 이 세션에서 진행하기로 했다.

원인: Vite 8은 압축할 때 라이선스 주석까지 지운다(`comments.legal: !minify`, `node_modules/vite/dist/node/chunks/node.js`). 원본 `react-dom-client.production.js` 머리에 있는 `@license React … Copyright (c) Meta Platforms` 주석이 번들에서 사라진다.

## 대상

`package-lock.json` 의 런타임(비dev) 패키지 11개 중 실제로 어디에 들어가는지로 나눈다.

| 번들 | 패키지 | 사용자에게 배포되나 |
| --- | --- | --- |
| 클라이언트(`dist/client`) | react, react-dom, scheduler — 모두 MIT | **예.** 브라우저가 내려받는다 → 고지 필요 |
| Worker(`dist/worker`) | @anthropic-ai/sdk 등 나머지(MIT, Apache-2.0 `@opentelemetry/api`, Unlicense `fast-sha256`) | 아니오. 우리 계정의 Cloudflare Worker에서만 돈다 |

## 방법

`vite.config.ts` 의 **클라이언트 환경에만**:

1. `build.license: { fileName: 'third-party-licenses.txt' }` — Vite 내장 기능. 번들에 든 `node_modules` 패키지마다 이름·버전·SPDX와 `LICENSE` 원문을 모아 `dist/client/third-party-licenses.txt` 로 낸다. 정적 자산이라 `/third-party-licenses.txt` 로 서빙된다.
2. `rolldownOptions.output.comments.legal: true` — 패키지 자체의 `@license` 머리 주석(저작권자 표기)을 남긴다.
3. `rolldownOptions.output.banner` — 각 JS 맨 앞에 `/*! Third-party licenses: /third-party-licenses.txt */`. webpack이 `main.js.LICENSE.txt` 와 함께 쓰는 것과 같은 방식이다.

| 결정 | 근거 |
| --- | --- |
| Vite 내장 `build.license` | 새 의존성 없이, 실제로 번들에 든 패키지만(모듈 ID 기준) 원문까지 모은다. 의존성이 바뀌어도 빌드마다 다시 만들어진다 |
| `.txt` | 내용은 Markdown이지만 `.md` 는 브라우저가 내려받기로 처리할 수 있다. `text/plain` 은 바로 보인다 |
| 클라이언트에만 | Worker 번들은 배포 대상이 아니다. Worker 출력에 `.txt` 를 만들면 wrangler 모듈 규칙(`**/*.txt` → Text)과 엮일 수 있어 피한다 |
| 주석과 원문 파일 둘 다 | 머리 주석만으로는 허락 문구 전문이 없다(LICENSE 파일을 가리킬 뿐). 원문 파일만으로는 JS 사본 안에 아무 표시가 없다. 둘이 함께 있어야 사본에 고지와 위치가 남는다 |
| 화면 링크는 넣지 않음 | UI·번역·테스트가 늘고, 고지 의무는 사본 안의 표시와 함께 서빙되는 원문으로 충족된다 |

## 범위

### 포함

- `vite.config.ts`: 위 설정과 상수 `THIRD_PARTY_LICENSES_FILE`
- `README.md`: 라이선스 절의 의존성 줄에 `/third-party-licenses.txt` 안내

### 제외

- Worker 번들 고지(위 근거). 저장소에는 `node_modules` 가 없고 `package.json` 으로만 의존성을 가리킨다
- 화면 푸터 링크
- 개인정보 원칙(제3자 요청 없음)은 그대로다. 새 파일은 같은 Worker 정적 자산이다

## 검증 계획

1. `npm run build` 뒤 `dist/client/third-party-licenses.txt` 가 react·react-dom·scheduler 원문을 담는지, 각 JS 첫 줄이 배너인지, `@license React` 주석이 남는지, Worker 출력에 라이선스 파일이 생기지 않는지
2. 번들 크기 변화
3. typecheck / lint / test / build 종료 코드 0
4. 독립 리뷰 → 병합 가능이면 사용자 승인 뒤 `--no-ff` 병합, 배포 뒤 `/third-party-licenses.txt` 응답 확인

법률 자문이 아니다.
