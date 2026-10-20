# 025 feature/generating-loader — 구현 문서

## 요약

생성 화면의 진행 막대 위에 움직이는 음파(막대 13개)를 넣었다. 분석·초상·리딩을 기다리는 동안 계속 오르내려 "작업 중"임이 보인다. 외부 이미지 없이 CSS 애니메이션만 쓰고, 장식이라 보조기기에서는 숨긴다. 움직임 줄이기 설정에서는 멈춘 파형으로 보인다.
초상이 실패했을 때 결과 화면의 문구를 "AI 초상은 준비 중이에요"(나중에 올 것처럼 읽힘)에서 "이번에는 AI 초상을 만들지 못해 목소리의 컬러와 사운드 시그니처로 그렸어요"로 바꿨다. 한국어 문구의 "당신"도 빠졌다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/components/VoiceLoader.tsx` | 새 컴포넌트. `div.voice-loader[aria-hidden]` 안에 `span.voice-loader__bar` 13개, 막대마다 `--h`(최대 높이 비율)와 `--i`(순번) 스타일 변수 |
| `src/components/loaderBars.ts` | 막대 높이 배열 `VOICE_LOADER_BARS`. 컴포넌트 파일에서 상수를 내보내면 oxlint `only-export-components` 경고가 나서 분리했다 |
| `src/screens/GeneratingScreen.tsx` | 진행 중 상태에서 진행 막대 위에 `<VoiceLoader />`. 실패 화면에는 넣지 않는다 |
| `src/styles/global.css` | `.voice-loader`(높이 72px, 간격 6px), `.voice-loader__bar`(폭 6px, 브랜드 그라데이션, `scaleY`로 0.3×h ↔ h를 1.1초 주기로 오르내리고, 순번마다 −0.09초씩 음수 지연), `@keyframes voice-loader-wave`, 움직임 줄이기에서 `animation: none` |
| `src/i18n/messages/ko.ts`, `en.ts` | `result.portraitPending` 문구 |
| `src/screens/GeneratingScreen.test.tsx` | 새 테스트 파일, 3건(아래) |
| `src/screens/ResultScreen.test.tsx` | 기존 테스트 이름의 "준비 중 안내" → "초상 실패 안내"(1차 리뷰 #2, 동작 변경 없음) |

## 추가한 테스트

| 테스트 | 확인하는 것 |
| --- | --- |
| 음파가 보이고 보조기기에서 숨김 | `voice-loader`에 `aria-hidden="true"`, 막대 수 = `VOICE_LOADER_BARS.length` |
| 막대 스타일 변수 | 첫·마지막 막대의 `--h`, `--i` |
| 진행 표시 유지 | `role="progressbar"`, `role="status"`, 첫 단계 문구가 그대로 있고 음파가 진행 막대보다 앞 |

결과 화면의 기존 테스트(`ResultScreen.test.tsx`)는 `result.portraitPending`를 키로 읽으므로 문구 변경 뒤에도 그대로 통과한다(초상 없을 때 보임, 있을 때 안 보임).

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 상수를 컴포넌트 파일에 | `loaderBars.ts`로 분리 | lint 경고(`only-export-components`) 0을 유지 |

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` | 종료 코드 0 |
| `npm run lint` | 종료 코드 0, 경고 0 |
| `npm test` | 종료 코드 0, 37 파일 278 테스트 |
| `npm run build` | 종료 코드 0 |

### 구현자 확인 (내장 브라우저)

생성 화면은 마이크 녹음이 있어야 들어갈 수 있어, 빌드된 CSS(`dist/client/assets/index-*.css`)와 같은 마크업을 스크래치 페이지에 띄워 확인했다(375×812).

- 다크: 막대 13개가 가운데가 높은 파형으로 보이고, 보라→주황 그라데이션. 계산된 스타일 `animation-name: voice-loader-wave`, `1.1s`, 막대마다 `transform` 값이 다름(움직이는 중)
- 라이트: 같은 모양, 다른 순간의 위상으로 오르내림
- 움직임 줄이기: 빌드된 CSS에 `.voice-loader__bar { animation: none }` 규칙이 들어 있음을 확인. 이 설정 자체는 도구로 흉내 낼 수 없어 규칙 존재까지만 확인했다

## 알려진 한계

- 할당량 소진(하루 6~7장 뒤)으로 초상이 실패하는 것 자체는 그대로다. 늘 초상까지 나오게 하려면 Cloudflare Workers 유료 플랜이 필요하다(초과분 1,000뉴런당 $0.011, 초상 1장 약 $0.016). 사용자 결정 사항이다.
- 기존 진행 막대의 대기 단계 깜빡임(`meter-pulse`)은 움직임 줄이기에서 전역 규칙에만 기대고 있다. 이번 범위 밖이다.
- 초상 기능이 꺼져 있거나(`features.portrait=false`) 설정 조회가 실패해 오프라인 설정을 쓸 때도 같은 문구("이번에는 … 만들지 못해")가 나온다. 지금 배포본은 기능이 켜져 있어 영향이 작다(1차 리뷰 #1).
- 실패 화면에 음파가 없다는 점은 테스트하지 않았다. 정적 렌더로는 실패 상태에 갈 수 없다(1차 리뷰 #6).
- 화면 확인은 내장 브라우저(Chromium)에서만 했다. iPhone Safari 실기기에서 음파 모양(가장 짧을 때 둥근 끝이 납작해짐 포함)을 한 번 보는 것이 좋다(1차 리뷰 #5·#6).
- 다른 문구의 "당신만의 목소리 지문"(`ko.ts`)은 이번 범위 밖이다(1차 리뷰 #4).

## 배포 후 확인

023·024·025를 main에 함께 병합(`4399733`)해 2026-10-20 16:11:05 KST에 푸시했다. Cloudflare Workers Builds가 자동 배포했다(배포 기록 07:11:32Z, 버전 `6f1ef7ab-4545-40f7-8998-35e5a8f4d3a1`). 배포 주소의 번들이 16:11:42 KST에 새 빌드(`index-np10x9bi.js`)로 바뀐 것을 확인했다.

16:11:59 KST, `https://vocatype.hs827.workers.dev`:

| 확인 | 결과 |
| --- | --- |
| `GET /`, `GET /api/health` | 200, 200 |
| `GET /api/config` | `{"provider":"workers-ai","textProviders":["claude","workers-ai"],"features":{"portrait":true,"reading":true}}` |
| 배포된 CSS(`index-CpSgsQrj.css`) | `.voice-loader__bar` 규칙과 `@keyframes voice-loader-wave` 있음(025) |
| 배포된 JS | 초상 실패 문구 "이번에는 AI 초상을 만들지 못해 목소리의 컬러와 사운드 시그니처로 그렸어요." 있음(025) |
| `POST /api/reading` ko `CLME` 1회 | 200, 3.6초, `provider: "claude"`. 4문장 163자, 캡션 22자("서리 내린 아침, 조용히 펼쳐지는 목소리"), "당신"·숫자 없음(024 배분 뒤에도 정상 경로 그대로) |

- 초상(`/api/portrait`)은 호출하지 않았다. 무료 할당량(1장 약 1,450뉴런)을 쓰고, 오늘은 이미 소진돼 있었다. 45초 상한(023)은 단위 테스트로만 확인했다.
- Claude 느린 실패 경로(024)는 운영에서 만들 수 없어 단위 테스트로만 확인했다.
- 음파 로더(025)는 마이크 녹음이 있어야 화면에 들어가므로, 배포본에서는 CSS·JS에 들어 있는지까지 확인했다. 실제 화면은 구현 때 내장 브라우저에서 확인했다.
