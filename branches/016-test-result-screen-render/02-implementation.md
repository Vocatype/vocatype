# 016 test/result-screen-render — 구현 문서

## 요약

`ResultScreen`을 `react-dom/server`의 `renderToStaticMarkup`으로 렌더하는 테스트 10개를 추가했다(테스트 파일 28 → 29, 테스트 181 → 191). DOM 라이브러리를 들이지 않고 Vitest `node` 환경을 유지했으며, 구현 코드는 바꾸지 않았다.
설계대로 두 가지 회귀(meter 눈금, 영어 소문자)를 일부러 넣어 테스트가 실패하는지 확인했다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/screens/ResultScreen.test.tsx` | 신설. 헬퍼 4개(`escape`, `attributes`, `openingTags`, `textOf`), 픽스처(축 값 0.8·0.52·0.2·0.45의 `WFME` 프로필, 한국어 리딩, 『서시』 12,345ms 캡처), `render()` 래퍼(`I18nProvider initialLocale`), 테스트 10개 |
| `vitest.config.ts` | `include`에 `src/**/*.test.{ts,tsx}` |
| `branches/016-test-result-screen-render/` | 설계·구현·리뷰 문서 |

## 테스트 목록 (설계 항목 ↔ 테스트)

| 설계 | 테스트 | 확인하는 것 |
| --- | --- | --- |
| 1 | 네 축이 타입 코드 글자 순서로 0~100 눈금의 meter로 읽힌다 | 픽스처 고정(`WFME`, 80·52·80·55), meter 4개의 `aria-valuemin/max/now/valuetext/label`, `role="list"`의 `aria-label` |
| 2 | 시각 머리글은 보조기기에서 숨긴다 | `.axis__head` 4개 모두 `aria-hidden="true"` |
| 3 | 경계 축만 안내 문구에 연결되고 비경계 축에는 연결이 없다 (ko / en) | `percent < BOUNDARY_PERCENT`인 축(밀도)만 `aria-describedby`와 같은 id의 문구, 나머지는 속성·문구 모두 없음. 문구는 `formatMessage`로 만든 기대값과 일치 |
| 3 | 영어 경계 안내는 반대 라벨을 소문자로 쓴다 | `A little light, too`, 대문자 버전 없음 |
| 4 | 신호가 부족하면 막대 없이 안내만 보인다 | meter 0개, `axis-note-` 없음, 신호 부족 문구 있음 |
| 5 | 리딩은 생성 언어와 화면 언어가 같을 때만 보인다 | ko 리딩 + ko 화면: 섹션 제목·본문·캡션·주의 문구. ko 리딩 + en 화면: 섹션·본문 없음, 카탈로그 설명은 있음 |
| 6 | 초상이 없으면 자리표시 초상과 준비 중 안내, 있으면 이미지가 보인다 | 자리표시 `role="img"` + `aria-label`, `<img>` 없음 / data URL이면 `<img src alt>` 하나, 자리표시·안내 없음 |
| 8 | 낭독 정보가 있으면 머리글에 제목과 길이를 쓰고, 없으면 머리글 설명이 없다 | `『서시』 낭독 · 0:12`, `capture` 없으면 `.screen__lead` 없음 |
| 7 | 결과가 없으면 안내와 처음으로 버튼만 보인다 | 안내·처음으로, meter 0, 카드 섹션·저장 버튼 없음 |

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 헬퍼 `openingTags`·`textOf` | + `escape`(React 이스케이프 `& < > " '`) | 카탈로그 문구·리딩에 `'`나 `"`가 들어가도 `toContain` 비교가 깨지지 않게 기대값을 마크업과 같은 형태로 맞춘다 |
| 기대 문구를 사전 문자열의 `{other}` 치환으로 | `formatMessage(messages[locale][key], params)`를 직접 호출 | 치환 규칙을 테스트가 다시 구현하지 않고, 사전·치환이 바뀌어도 의도("화면 문구와 같다")가 유지된다 |
| 검사 항목 8개 | 테스트 10개 | 경계 안내는 ko/en을 `it.each`로 나누고 영어 소문자는 읽기 쉽게 별도 테스트로 뒀다 |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과(`.test.tsx`가 `tsconfig.app.json`의 `src`에 포함됨) |
| 린트 | `npm run lint` | 경고 0, 오류 0 |
| 단위 테스트 | `npm test` | 29 파일 191 테스트 통과, 종료 코드 0 |
| 빌드 | `npm run build` | 통과 |
| 회귀 감지 (구현자 확인) | `aria-valuemax={100}` → `99` | 1개 실패: `temperature: expected '99' to be '100'` |
| 회귀 감지 (구현자 확인) | 영어 안내의 `.toLowerCase()` 제거 | 2개 실패: `expected 'A little Light, too' to be 'A little light, too'` |
| 복원 확인 | `git checkout -- src/screens/ResultScreen.tsx` 뒤 `npm test` | 191 통과, 작업 트리에 구현 변경 없음 |

## 알려진 한계

- 정적 렌더라 효과(`useEffect`)·상태 변화(저장 중/저장됨 문구, 공유 버튼 표시)는 검사하지 않는다. 그 부분은 캔버스와 `navigator.share`가 필요해 브라우저 확인으로 남는다.
- 속성 파싱은 `name="value"` 형태의 열림 태그만 다룬다. React의 정적 마크업은 항상 이 형태라 충분하지만, 다른 렌더러의 출력에는 쓸 수 없다.
