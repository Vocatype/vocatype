# 034 fix/reading-ai-badge-tone — 구현 문서

작업 브랜치: `claude/ai-model-migration-e64f72`(앱이 만든 worktree 브랜치). 병합할 때 `fix/034-reading-ai-badge-tone` 을 만들어 `--no-ff` 로 병합한다.

## 변경 파일(2차 리뷰 반영 뒤 최종)

| 파일 | 내용 |
| --- | --- |
| `src/screens/ResultScreen.tsx` | 해설 카드의 `card__note` 문단 삭제, 제목 안에 `<span className="card__badge">{t('result.aiBadge')}</span>`. `PortraitFrame` 에 `badge`, 공유 이미지 라벨에 `aiMark` 를 넘김 |
| `src/components/PortraitFrame.tsx` | 선택 속성 `badge`. 생성 초상일 때만 `<span className="portrait__badge">` |
| `src/features/export/renderCard.ts` | `CardLabels.aiMark`. 생성 초상이면 초상 오른쪽 위 안쪽(24px)에, 자리표시 초상인데 캡션이 있으면 캡션 오른쪽(간격 16px, 캡션과 한 덩어리로 가운데)에 어두운 반투명 알약 + 흰 "AI" 30px(`drawAiMark`, `aiMarkWidth`) |
| `src/i18n/messages/ko.ts`, `en.ts` | `result.readingNote` 삭제, `result.aiBadge: 'AI'` |
| `src/styles/global.css` | `.card__badge`(글자 `color-mix(var(--accent) 75%, var(--fg))`), `.portrait` 에 `position: relative`, `.portrait__badge` |
| `shared/catalog.ts` | 16개 타입 한국어 설명의 첫 문장을 해요체로 |
| `worker/ai/readingOutput.ts` | `checkKoreanPoliteStyle`(문장이 `…다·…니까·…십시오` 로 끝나면 위반), `splitSentences`(문장 속 인용 합치기), `SENTENCE_BREAK`·`SENTENCE_TAIL`, `normalizeReadingOutput(value, locale)`·`parseReadingJson(text, locale)` |
| `worker/ai/claude.ts` | `parseReadingMessage(message, locale)`, 호출부가 `input.locale` 을 넘김 |
| `worker/ai/workersAiText.ts` | `parseWorkersAiTextResult(result, locale)`, 호출부가 `input.locale` 을 넘김 |
| `worker/ai/readingPrompt.ts` | 한국어 규칙: "모든 문장을 해요체(…요·…죠)로 끝내고 합니다체(…니다)는 쓰지 않는다" |
| `README.md` | 실패 조건 두 곳에 문체, 알려진 한계에 AI 표시 범위(캡션 옆, 공유 시트 본문, 안내문 합니다체 유지)와 해요체 검사의 한계 |
| 테스트 | 아래 |

| 테스트 파일 | 내용 |
| --- | --- |
| `worker/ai/readingOutput.test.ts` (새 파일) | 해요체 통과 14가지(끝 따옴표·물결·말줄임·전각·이모지·괄호·중간 물음표·인용 속 반말·영어 약어·…다로 끝나는 문장 속 인용 3가지), 위반 11가지(`.”`·`.)`·`。`·`⋯`·`~` 뒤, 문장 앞 인용, 합니다체 의문·명령, 문장 번호만 담음), 영어·캡션은 검사 안 함 — 3건 |
| `worker/ai/claude.test.ts` | 합니다체가 섞이면 한 번 더 부르고, 같은 섞인 글도 영어 요청이면 한 번만 부르고 그대로 돌려줌 — 1건 |
| `worker/ai/workersAiText.test.ts` | 섞인 ko 응답 실패, `en` 통과, 제공자가 요청 언어를 넘김 — 2건 |
| `worker/ai/readingPrompt.test.ts` | 새 한국어 규칙 문구, 16개 타입 설명이 모두 문체 검사를 통과 — 1건 |
| `src/features/export/renderCard.test.ts` | 생성 초상이면 오른쪽 위 안쪽·clip 밖에만 "AI", 자리표시 초상이면 캡션 오른쪽 같은 줄(가운데 정렬·여백 안), 캡션·표시가 없으면 없음 — 2건. 028 간격 검사는 자기 바탕 알약 안의 글자만 예외로 두고, 기존 배치·겹침 테스트가 캡션 옆 표시까지 함께 검사 |
| `src/screens/ResultScreen.test.tsx` | 해설 배지 있음·안내 문장 없음, 생성 초상에 `portrait__badge`, 자리표시 초상에는 없음 |

## 설계 대비 달라진 점

1차·2차 리뷰 뒤 사용자 결정과 지적으로 바뀌었다. 01의 "1차 리뷰 뒤 바뀐 설계"와 "2차 리뷰 뒤 바뀐 설계" 표가 전부다. 바뀐 것은 다음과 같다.

- 타입 설명 해요체화
- 판정 규칙: 요·죠 → '다' → `…다·…니까·…십시오`
- 문장 나누기와 문장 속 인용 합치기
- 배지 대비
- 초상·공유 이미지 AI 표시(자리표시면 캡션 옆)
- 메시지 키 이름
- 공유 이미지 표시 글자 크기

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` / `lint` / `build` | 종료 코드 0 |
| `npm test` | 39파일 326건 통과(이 작업에서 9건 추가) |
| `git diff --check` | 공백 문제 없음 |
| 빌드된 번들 | CSS에 `.card__badge`, JS에 "녹음은 듣지 않았어요" 0건 |

변이 확인(관련 테스트 파일만 실행, 확인 뒤 원래대로 되돌리고 `cmp` 로 같음 확인):

| 변이 | 실패한 테스트 |
| --- | --- |
| 해요체 검사 호출 제거(1차 전 규칙에서) | 2건 |
| 허용 끝 글자에서 '죠' 제거(1차 전 규칙에서) | 1건 |
| 오류 메시지에 문장 본문 넣기 | 1건 |
| 타입 설명을 옛 문구(합니다체)로 되돌리기 | 1건 |
| 자리표시 초상에도 공유 이미지 표시 | 5건 |
| 공유 이미지 표시 호출 제거 | 1건 |
| 결과 화면 초상 배지 제거 | 1건 |
| 생성 초상이 있어도 캡션 옆 표시(2차 반영 뒤) | 1건 |
| 캡션 옆 표시 호출 제거 | 1건 |
| 문장 속 인용 합치기 끄기 | 2건 |
| 판정을 '다'만으로 되돌리기 | 1건 |

### 구현자 확인(내장 브라우저)

결과 화면은 녹음이 있어야 들어갈 수 있다. 그래서 030처럼 개발 서버에 임시 미리보기 페이지를 두었다(`preview-034.html`, `src/preview034.tsx`, `public/preview-034-portrait.jpg`, 확인 뒤 세 파일 삭제). 합성 프로필로 실제 `ResultScreen` 과 `renderCard` 를 그렸다. 초상은 031 첫 실호출에서 받은 운영 이미지 한 장이고, AI 호출은 없다.

| 확인 | 결과 |
| --- | --- |
| 해설 제목 | 접근성 이름 "목소리 해설 AI". 배지 글자 "AI" 11.2px, `text-transform: none`. 라이트 글자색은 `color-mix` 결과 |
| 해설 배지(1차 전 색) | 다크 바탕 `rgb(36, 31, 69)`/글자 `rgb(143, 130, 255)`, 라이트·375px 바탕 `rgb(239, 234, 255)`/글자 `rgb(109, 93, 252)`, 가로 스크롤 없음 |
| 결과 화면 초상 | 320×320 초상 오른쪽 위(오른쪽·위 10px)에 "AI" 알약, 사진 위에서 읽힘 |
| 타입 설명 | "따뜻하고 꽉 찬 목소리가 빠르게 굽이쳐요. …" |
| 공유 이미지 | 1080×1920. 초상 오른쪽 위 안쪽에 "AI" 알약, 사진 위에서 읽힘 |
| 안내 문장 | 페이지에 "녹음은 듣지 않았어요" 없음 |

## 확인하지 못한 것

- 실제 Claude 출력이 새 검사를 통과하는 비율. 타입 설명을 고쳐 섞임이 줄 것으로 보지만 실측은 없다. 배포 뒤 Worker 로그의 `reading style` 줄로 본다.
- 해요체 검사의 한계(README 알려진 한계): 끝 구두점 뒤 공백 없이 이어진 문장, 해체·명사 종결.
- 공유 이미지 캡션에는 따로 AI 표시가 없다. AI 표시가 법적으로 충분한지는 확인하지 않았다(법률 자문 아님).
- 결과 화면 초상 배지는 보조기기에 "AI"로 읽힌다. `alt` 문구는 바꾸지 않았다.
