# 030 fix/signature-caption — 구현 문서

## 요약

결과 화면 사운드 시그니처 설명을 그림이 실제로 보여 주는 것으로 바꿨다. "당신만의 목소리 지문", "Your voice fingerprint"를 빼서, 사람을 알아보는 생체 정보처럼 들리지 않게 했다. 같은 표현이 화면 문구로 다시 들어오지 않게 회귀 테스트를 더했다.

| 언어 | 전 | 후 |
| --- | --- | --- |
| ko | 녹음의 에너지 흐름을 원형으로 그린, 당신만의 목소리 지문 | 이번 녹음에서 소리가 커지고 작아진 흐름을 12시 방향부터 시계 방향으로 그렸어요. |
| en | Your voice fingerprint: the energy of your recording drawn in a circle | How this recording got louder and softer over time, drawn clockwise from 12 o'clock. |

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/i18n/messages/ko.ts`, `en.ts` | `result.signatureCaption` 문구(키 그대로) |
| `src/i18n/messages/messages.test.ts` | 문자열 꺼내기 도우미 `strings`. 테스트 "화면 문구는 녹음을 사람을 알아보는 생체 정보처럼 말하지 않고(지문·fingerprint·voiceprint), '당신'을 쓰지 않는다": ko·en 사전 전체와 카탈로그(`AXES`, 16타입의 `getVoiceType`·`getPersonalColor`·`getScent`·`getCompatibility`)의 모든 문자열 |

## 설계 대비 달라진 점

없음.

## 다른 "지문" 표현 확인

`src`, `shared`, `worker`, `index.html`, `public`, `README.md`를 "지문", "fingerprint", "voiceprint", "당신"으로 검색했다. 바꾼 두 문구 말고는 해설 프롬프트의 "당신"을 쓰지 말라는 지시문(`worker/ai/readingPrompt.ts`, 화면 문구 아님)뿐이다. 빌드한 클라이언트 번들에도 "fingerprint", "목소리 지문"이 없다(아래).

## 회귀를 잡는지(일부러 바꾼 뒤 되돌림)

변경을 먼저 커밋(`1380afb`)한 뒤 바꾸고 `git checkout`으로 되돌렸다.

| 바꾼 것 | 결과 |
| --- | --- |
| ko 문구를 옛 문구로 | 새 테스트 실패 |
| en 문구를 옛 문구로 | 새 테스트 실패 |
| en 문구에 "a voiceprint" | 새 테스트 실패 |
| 카탈로그 첫 축 라벨(`AXES`) 앞에 "당신의" | 새 테스트 실패 |
| 궁합 설명(en)에 "A fingerprint:" | 새 테스트 실패 |
| 향 분위기(`SCENT_MOODS`, ko)에 "목소리 지문 같은" | 새 테스트 실패 |
| 타입 설명(ko) 앞에 "당신은" | 새 테스트 실패 |

## 구현자 확인(내장 브라우저)

결과 화면은 마이크 녹음이 있어야 들어갈 수 있다. 그래서 개발 서버에 임시 미리보기 페이지(`preview-030.html`, `src/preview030.tsx`, 확인 뒤 삭제)를 두고, 합성 프로필(WFQV)로 실제 `ResultScreen`을 그려 375×812에서 봤다. AI 호출은 없다(초상·해설 없음 상태).

- ko: 사운드 시그니처 고리 아래에 새 문구가 두 줄로 나온다. 375px에서 "12시 방향 / 부터"처럼 낱말 가운데서 줄이 바뀐다. 앱 CSS에 한국어 줄바꿈 규칙(`word-break: keep-all`)이 없어 다른 한국어 문장도 똑같이 바뀐다(이번 범위 밖, 아래 알려진 한계)
- en: 새 문구가 두 줄로 나오고, 페이지에 "fingerprint"가 없다. 문구 색은 `rgb(163, 158, 150)`(`--fg-muted`)이다

## 빌드 결과

클라이언트 JS가 `index-DijGa0wH.js`에서 `index-6iYTXeNv.js`로 바뀌었다(CSS는 `index-CpSgsQrj.css` 그대로). 새 JS에 "louder and softer" 1건과 "이번 녹음에서 소리가 커지고 작아진 흐름을 12시 방향부터 시계 방향으로 그렸어요." 1건이 있고, "fingerprint"와 "목소리 지문"은 0건이다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` / `lint` / `build` | 종료 코드 0 |
| `npm test` | 종료 코드 0, 37 파일 300 테스트(299 + 1) |

## 알려진 한계

- 한국어 문장은 앱 전체에서 음절 단위로 줄이 바뀐다(`word-break: keep-all` 없음). 이 문구도 375px에서 "방향 / 부터"로 나뉜다. 화면 전체 글꼴·줄바꿈 규칙을 바꾸는 일이라 따로 다룬다
- 회귀 테스트는 정해 둔 낱말(지문, fingerprint, voiceprint, 당신)만 본다. "고유한 목소리 서명"처럼 다른 말로 같은 과장을 하면 잡지 못한다
- 해설 본문(AI가 만드는 글)은 이 테스트 대상이 아니다. "당신" 규칙은 해설 프롬프트와 배포 후 출력 점검이 맡는다
