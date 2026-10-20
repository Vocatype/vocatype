# 016 test/result-screen-render — 설계 문서

## 배경

013(축 강도)에서 `ResultScreen`의 접근성 구조(`role="meter"` 0~100 눈금, `aria-valuetext`, 경계 안내 `aria-describedby`, 영어 안내의 소문자 라벨)는 브라우저로만 확인했고, 2차 리뷰가 "렌더 테스트 없음"을 선택 항목(f)으로 남겼다. 인수인계 후보 3번.
지금 저장소에는 React 컴포넌트를 렌더하는 테스트가 없고(순수 함수·캔버스 가짜 컨텍스트 테스트만), Vitest는 `node` 환경에 `*.test.ts`만 포함한다.

## 목표

`ResultScreen`을 `react-dom/server`의 `renderToStaticMarkup`으로 렌더해, 브라우저 확인으로 대체했던 접근성·표시 규칙을 테스트로 고정한다. 회귀가 생기면 `npm test`에서 바로 드러나야 한다.

## 범위

### 포함

- `src/screens/ResultScreen.test.tsx` 신설. 검사 항목:
  1. 축 행 4개가 타입 코드 글자 순서로 `role="meter"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow`=퍼센트, `aria-valuetext`="{라벨} {퍼센트}%", `aria-label`=축 이름으로 렌더된다. 목록은 `role="list"`와 이름(`aria-label`)을 가진다.
  2. 시각 머리글(글자·라벨·퍼센트)은 `aria-hidden="true"`다.
  3. 경계 축(표시값 < 55)만 `aria-describedby="axis-note-{key}"`로 안내 문구에 연결되고, 그 id의 문구가 있다. 비경계 축에는 `aria-describedby`가 없다. 한국어 "{반대 라벨} 성향도 조금 있어요", 영어 "A little {반대 라벨 소문자}, too".
  4. `quality: 'low-signal'`이면 meter가 없고 신호 부족 안내가 있다.
  5. 리딩은 생성 언어와 화면 언어가 같을 때만 섹션이 보이고, 다르면 섹션·문장이 없다.
  6. 초상이 없으면 자리표시 초상(`role="img"`, alt)과 "준비 중" 안내, 있으면 `<img src=data URL alt>`.
  7. `profile`이 없으면 "결과 없음" 안내와 처음으로 버튼만 있고 meter·섹션이 없다.
  8. 낭독 정보(`capture`)가 있으면 머리글에 『제목』 낭독 · m:ss, 없으면 머리글 설명이 없다.
- `vitest.config.ts`의 `include`에 `src/**/*.test.tsx` 추가.

### 제외

- DOM 라이브러리(jsdom, happy-dom, Testing Library) 추가. 정적 마크업 문자열에서 열림 태그를 찾아 속성을 읽는 작은 헬퍼로 충분하고, 의존성을 늘리지 않는다.
- 저장·공유 버튼의 동작(클릭 뒤 상태)은 캔버스·`navigator.share`가 필요해 범위 밖. 버튼 존재만 본다.
- `ResultScreen` 구현 변경. 테스트가 실패하면 구현이 아니라 테스트 기대값부터 의심하되, 실제 결함이면 별도 fix 브랜치로 뺀다.

## 구조

- 렌더: `renderToStaticMarkup(<I18nProvider initialLocale={locale}><ResultScreen … /></I18nProvider>)`. `I18nProvider`의 `useEffect`(document.lang)는 서버 렌더에서 실행되지 않고, `ResultScreen`의 `useState(() => canShareFiles())`는 Node에서 `navigator.share`가 없어 false, 선생성 `useEffect`도 실행되지 않는다. 따라서 캔버스·DOM 없이 렌더된다.
- 헬퍼: `openingTags(html, /<div[^>]*role="meter"[^>]*>/g)` → 각 태그의 `name="value"` 속성을 객체로. `textOf(html, id)` → 그 id 요소의 안쪽 텍스트.
- 픽스처: `VoiceProfile`(축 값은 경계·비경계가 섞이도록 warmth 0.8, density 0.52, pace 0.2, variation 0.45 → 타입 `WFME`, 퍼센트 80·52·80·55, 경계는 밀도 축만), `VoiceReading`(ko), `Capture`(제목 『서시』, 12,345ms → "0:12"). `renderCard.test.ts`의 픽스처와 축 값이 달라야 해서 이 파일 안에 둔다.

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| `renderToStaticMarkup` + 문자열 검사 | 013 리뷰가 제안한 방법. 의존성 0, `node` 환경 유지, 2초대 테스트 시간 유지 |
| 속성은 정규식으로 열림 태그만 파싱 | 검사 대상이 `role`·`aria-*`·`id`·`src`·`alt` 같은 단순 속성이라 HTML 파서가 필요 없다. 값에 `"`가 들어가면 React가 `&quot;`로 이스케이프하므로 `"[^"]*"` 매칭이 깨지지 않는다 |
| 경계 55% 기준을 테스트가 직접 쓰지 않고 `BOUNDARY_PERCENT` 상수를 import | 기준이 바뀌어도 테스트 의도("경계 축만 연결")가 유지된다 |
| 픽스처 중복 허용 | 두 테스트의 축 값 요구가 다르고, 공용 픽스처 모듈을 만들면 그 모듈도 lint·타입 대상이 되어 범위가 커진다 |

## 검증 계획

- `npm test` 종료 코드 0, 새 테스트 파일이 실행 목록에 포함(파일 수 28 → 29).
- typecheck(`tsconfig.app.json`이 `src` 전체를 포함하므로 `.test.tsx`도 검사) / lint / build 통과.
- 회귀 감지 확인: `aria-valuemax`를 임시로 바꾸면 테스트가 실패하는지 한 번 본다(구현자 확인 행으로 기록).
