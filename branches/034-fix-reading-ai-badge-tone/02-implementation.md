# 034 fix/reading-ai-badge-tone — 구현 문서

작업 브랜치: `claude/ai-model-migration-e64f72`(앱이 만든 worktree 브랜치). 병합할 때 `fix/034-reading-ai-badge-tone` 을 만들어 `--no-ff` 로 병합한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/screens/ResultScreen.tsx` | 해설 카드의 `<p className="card__note">{t('result.readingNote')}</p>` 삭제, 제목 안에 `<span className="card__badge">{t('result.readingBadge')}</span>` |
| `src/i18n/messages/ko.ts`, `en.ts` | `result.readingNote` 삭제, `result.readingBadge: 'AI'` |
| `src/styles/global.css` | `.card__badge`(작은 알약 모양, `--accent-soft` 바탕·`--accent` 글자, 0.7rem, 제목의 대문자 변환을 따르지 않음) |
| `worker/ai/readingOutput.ts` | `checkKoreanPoliteStyle`(새 함수), `normalizeReadingOutput(value, locale)`·`parseReadingJson(text, locale)`. `ko` 면 해요체 검사 |
| `worker/ai/claude.ts` | `parseReadingMessage(message, locale)`, 호출부가 `input.locale` 을 넘김 |
| `worker/ai/workersAiText.ts` | `parseWorkersAiTextResult(result, locale)`, 호출부가 `input.locale` 을 넘김 |
| `worker/ai/readingPrompt.ts` | 한국어 규칙을 "모든 문장을 해요체(…요·…죠)로 끝내고 합니다체(…니다)는 쓰지 않는다"로 |
| `worker/ai/readingOutput.test.ts` (새 파일) | 해요체 통과(…요·…죠·물음표·느낌표·말줄임·물결·따옴표·끝 마침표 없음), 위반(합니다체·해라체, 문장 번호만 담고 본문은 없음), 영어는 검사 안 함, 캡션은 검사 안 함 — 3건 |
| `worker/ai/claude.test.ts` | `parseReadingMessage` 호출에 `'ko'`. 합니다체가 섞이면 한 번 더 부르는지, 영어는 한 번만 부르는지 — 1건 추가 |
| `worker/ai/workersAiText.test.ts` | `parseWorkersAiTextResult` 호출에 `'ko'` |
| `worker/ai/readingPrompt.test.ts` | 새 한국어 규칙 문구 |
| `src/screens/ResultScreen.test.tsx` | 배지 마크업이 있고 "녹음은 듣지 않았어요"가 없는지 |

## 설계 대비 달라진 점

없음.

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` / `lint` / `build` | 종료 코드 0 |
| `npm test` | 39파일 321건 통과(새 테스트 4건) |
| `git diff --check` | 공백 문제 없음 |
| 빌드된 번들 | CSS에 `.card__badge`, JS에 "녹음은 듣지 않았어요" 0건 |

변이 확인(관련 테스트 3파일, 확인 뒤 원래대로 되돌리고 `cmp` 로 같음 확인):

| 변이 | 실패한 테스트 |
| --- | --- |
| 해요체 검사 호출 제거 | 2건 |
| 허용 끝 글자에서 '죠' 제거 | 1건 |
| 오류 메시지에 문장 본문 넣기 | 1건 |

### 구현자 확인(내장 브라우저)

결과 화면은 녹음이 있어야 들어갈 수 있다. 그래서 030처럼 개발 서버에 임시 미리보기 페이지(`preview-034.html`, `src/preview034.tsx`)를 두었다. 합성 프로필(WFME)과 해요체 해설로 실제 `ResultScreen` 을 앱의 바깥 틀(`.app > main.main`) 안에 그렸고, 확인 뒤 두 파일은 지웠다. AI 호출은 없다.

| 확인 | 결과 |
| --- | --- |
| 제목 | 접근성 이름 "목소리 해설 AI". 배지 글자 "AI", 11.2px, `text-transform: none` |
| 다크 | 배지 바탕 `rgb(36, 31, 69)`, 글자 `rgb(143, 130, 255)` |
| 라이트·375px | 배지 바탕 `rgb(239, 234, 255)`, 글자 `rgb(109, 93, 252)`. 가로 스크롤 없음 |
| 안내 문장 | 페이지에 "녹음은 듣지 않았어요" 없음 |

## 확인하지 못한 것

- 실제 Claude 출력의 해요체 통과율. 위반 비율이 높으면 재호출이 늘고, 재호출도 실패하면 Workers AI 예비가 쓰인다. 예비도 위반이면 고정 문구(카탈로그 설명)가 나온다. 배포 뒤 Worker 로그의 `reading style` 줄로 본다.
- 문장 나누기는 끝 구두점 뒤 공백 기준이다. 따옴표 안에 마침표가 있는 글처럼 드문 경우는 한 문장으로 묶이거나 나뉠 수 있다. 그러면 정상 해설이 거절될 수도, 섞인 해설이 통과할 수도 있다.
- AI 표시의 법적 충분성(AI 기본법). 초상·공유 카드에는 표시가 없다. 법률 자문이 아니다.
