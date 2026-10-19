# 005 feature/result — 구현 문서

## 요약

결과 화면을 완성했다. 분석 프로필을 현재 언어로 풀어낸 `ResultView` 하나를 화면과 저장 이미지가 함께 쓴다.
초상 카드(초상·타입·설명·축), 퍼스널 컬러, 시그니처 향, 사운드 시그니처, 목소리 궁합 섹션을 보여 주고, "이미지로 저장"이 캔버스에 1080×1920 PNG를 그려 내려받는다. 공유 API를 지원하는 기기에서는 "공유" 버튼이 함께 나온다.
초상 이미지는 006 전까지 `null`이며 퍼스널 컬러 그라디언트 위에 사운드 시그니처를 올린 자리표시 초상을 쓴다.
1차 리뷰 반영(커밋 `dc52178`)과 2차 리뷰 반영까지 포함한 최종 상태를 기록한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/features/signature/signature.ts` | `resampleEnvelope`(180빈 정규화), `signatureBars`(방사형 막대 좌표) |
| `src/features/signature/signature.test.ts` | 빈 수·정규화·12시 시작·최소 길이 |
| `src/features/signature/contrast.ts`, `contrast.test.ts` | hex 파싱(3·6자리), 휘도, 자리표시 초상의 서명 색 선택 |
| `src/features/profile/present.ts` | `presentResult(profile, capture, locale)` → `ResultView` |
| `src/features/profile/present.test.ts` | 로케일 치환, 통계 단위, 녹음 정보 반영 |
| `src/features/export/wrapText.ts` | 캔버스 줄바꿈(공백 단위, 긴 단어는 글자 단위) |
| `src/features/export/wrapText.test.ts` | 영어·한국어·긴 단어·문단 |
| `src/features/export/renderCard.ts` | 1080×1920 캔버스 렌더링(`drawCard` 분리, 줄 수 제한 `clampLines`, 넘침 예외), `loadImage` |
| `src/features/export/renderCard.test.ts` | 가짜 2D 컨텍스트로 16타입 × ko/en 글자 좌표가 캔버스 안·하단 문구 위에 있는지 검사 |
| `src/features/export/save.ts` | `downloadBlob`, `shareBlob`, `canShareFiles` |
| `src/components/SoundSignature.tsx` | 원형 파형 SVG (`role="img"` + `aria-label`, 장식이면 `aria-hidden`) |
| `src/components/PortraitFrame.tsx` | 초상 이미지 또는 자리표시 초상 |
| `src/screens/ResultScreen.tsx` | 결과 카드 섹션, 저장·공유(이미지 선생성 캐시)·다시 하기·처음으로, 신호 부족 안내, 저장 상태 |
| `src/App.tsx` | `portrait` 상태 추가, 결과 화면에 `capture`·`profile`·`portrait` 전달 |
| `src/i18n/messages/{ko,en}.ts` | 결과 화면 메시지 26개 추가, 임시 `result.axes` 삭제 |
| `src/styles/global.css` | 결과 카드, 스와치, 노트, 궁합, 저장 상태 스타일. 임시 `.debug` 삭제 |

## 주요 구현

- **한 번의 치환**: `presentResult`가 카탈로그의 `Localized` 값을 현재 로케일로 풀고 통계를 사람 단위(Hz, 분당 음절, 길이)로 바꾼 `ResultView`를 만든다. 화면과 캔버스가 같은 객체를 쓰므로 둘이 어긋나지 않는다. 로케일을 바꾸면 `useMemo`가 다시 계산해 화면 전체가 즉시 바뀐다.
- **사운드 시그니처**: 004의 `envelope`(말하는 구간 프레임 RMS)를 180빈으로 평균·정규화하고, `signatureBars`가 12시 방향부터 시계 방향으로 방사형 막대 좌표를 만든다. 값 0도 최소 길이(8%)를 가져 원형이 유지된다. SVG(결과 섹션에서는 `role="img"` + `aria-label`, 자리표시 초상 안에서는 장식 `aria-hidden`)와 캔버스가 같은 좌표 함수를 쓴다.
- **자리표시 초상**: 초상 이미지가 없으면 퍼스널 컬러 대표색 두 개의 그라디언트 위에 사운드 시그니처를 올린다. 선 색은 두 색 중 밝은 쪽의 휘도가 0.4를 넘으면 어두운 선, 아니면 흰 선(`signatureInkFor`)이라 봄 웜·여름 쿨처럼 밝은 팔레트에서도 보인다. 안내 문구로 AI 초상이 준비 중임을 밝힌다.
- **캔버스 카드**: 1080×1920. 세로 배치는 커서 `y`로 누적하고 이름 2줄·설명 3줄·향 이름 2줄·노트 1줄·궁합 2행으로 줄 수를 제한(`clampLines`, 말줄임표가 폭 안에 들도록 글자를 더 줄임)해, 모든 제한이 꽉 찬 최악 조합도 하단 문구 영역(1800px) 위에서 끝나도록 간격을 잡았다(초상 400px). 넘치면 예외를 던지고, 테스트가 16타입 × ko/en 전부의 글자 좌표와 최악 조합 예산을 검사한다. 구성: 어두운 바탕 + 대표색 방사형 글로우, 초상 420px 둥근 사각형(이미지는 cover 방식, 없으면 자리표시), 타입 코드·이름·설명, 축 칩 4개, 퍼스널 컬러 스와치 5개와 hex, 향 이름·노트(왼쪽)와 사운드 시그니처·통계 두 줄(오른쪽), 궁합 두 칸, 하단에 낭독 작품·날짜·서비스 이름. `wrapText`는 공백 단위로 자르고 한 단어가 폭을 넘으면 글자 단위로 자르며, 캔버스 없이 `measure` 함수를 주입해 테스트한다. 외부 폰트·이미지를 쓰지 않아 캔버스가 오염되지 않는다.
- **저장과 공유**: 다운로드는 `<a download>`에 blob URL을 걸어 클릭하고 10초 뒤 해제한다. `navigator.canShare({ files })`가 참인 기기에서만 "공유" 버튼이 나오고, 사용자가 시트를 닫으면(`AbortError`) 상태를 되돌린다. 공유 시트는 사용자 제스처 직후에만 열리므로, 결과 화면이 마운트되고 300ms 뒤 이미지를 미리 만들어 Promise로 캐시해 둔다(언어·초상이 바뀌면 다시, 실패하면 비움). 선생성 중에 버튼을 눌러도 같은 Promise를 기다리므로 렌더가 중복되지 않는다. 캐시가 없어 제스처가 만료되면(`NotAllowedError`) "한 번 더 눌러 주세요"를 안내하고 두 번째 클릭은 캐시로 바로 연다. 파일 이름은 `voiceportrait-<타입코드>.png`.
- **접근성**: 각 섹션은 `aria-labelledby`로 제목과 묶이고, 축 칩 목록·스와치·노트(`dl`)는 의미 요소로 구성했다. 저장 상태는 `role="status"`. 저장 중 버튼은 `aria-busy`·`aria-disabled`로 표시해 키보드 초점이 유지된다. 타입 코드 앞에 숨김 텍스트 라벨. 자리표시 초상은 컨테이너가 `role="img"`라 안쪽 SVG는 장식(`aria-hidden`)이며, 서명 색은 팔레트 휘도로 어두운 선/흰 선을 고른다.

## 설계 대비 달라진 점

| 설계 | 구현 | 이유 |
| --- | --- | --- |
| 초상 560px | 420px | 리뷰 1. 560px로는 궁합 섹션이 캔버스 밖으로 밀렸다. 줄 수 제한과 함께 300px 이상 회수. |
| `renderCard(view, image, { serviceName, locale, date })` | `renderCard(view, image, labels)` — 섹션 제목 등 문구를 화면이 `t()`로 만들어 넘김 | 캔버스 모듈이 i18n 훅에 의존하지 않게. 문구 출처가 메시지 사전 한 곳으로 유지된다. |
| `saveImage(blob, filename)` 한 함수 | `downloadBlob` / `shareBlob` 분리, 버튼도 둘 | 데스크톱에서는 바로 내려받고 모바일에서는 공유 시트를 고를 수 있게. |
| 통계에 `pitchHz`·`syllablesPerMinute`·`durationMs` | 같음. `durationMs`는 녹음 길이를 우선 사용 | 분석용 길이(디코딩 후)는 끝 무음이 잘릴 수 있어 녹음 길이가 사용자 기대와 맞다. |

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 |
| 린트 | `npm run lint` | 경고 0, 오류 0 (공유 가능 여부는 effect 대신 `useState` 초기화로) |
| 단위 테스트 | `npm test` | 16 파일 95 테스트 통과 (서명 빈·정규화·12시 시작·최소 길이, 대비 헬퍼, 로케일 치환·통계 단위·녹음 정보, 줄바꿈 영어·한국어·긴 단어·문단, 캔버스 좌표 검사 16타입 × ko/en과 궁합 줄 수, 최악 조합 예산, 궁합 섹션이 하단 문구 위·통계가 서명 아래, 폭 인지 말줄임) |
| 빌드 | `npm run build` | 통과 |
| 결과 화면 (PC·다크·한국어) | 브라우저, 말소리형 합성 스트림 130Hz·5음절/초 | 『진달래꽃』 낭독 · 0:07, `WFME · 깊은 숲의 안내자`, 섹션 4개(퍼스널 컬러 스와치 5, 향 노트 3줄, 사운드 시그니처 막대 180, 궁합 2칸), 버튼 이미지로 저장·다시 하기·처음으로 |
| 이미지 저장 | 브라우저, `<a download>` 클릭을 가로채 blob 검사 | 영어(`WLQE · The Sunlit Stroller`, 봄 웜)와 한국어 각각 `voiceportrait-WLQE.png`, `image/png`, 1080×1920, 1.3MB. 이미지를 화면에 띄워 초상(밝은 팔레트 위 어두운 서명)·타입·설명·칩·스와치·향 노트·시그니처와 통계 두 줄·**궁합 두 칸**·하단 문구가 모두 캔버스 안에 그려진 것을 확인. 1차 리뷰 전에는 궁합 섹션이 1920px 밖에 그려졌고 이 표의 기록이 틀려 있었다. 상태 문구 "이미지를 저장했어요" |
| 모바일 375px · 라이트 · 영어 | 브라우저 | 가로 넘침 없음(`scrollWidth === innerWidth`). 스와치 5칸, 궁합 1열, 저장 버튼. English 전환 시 모든 문구 교체(`The Deep Forest Guide`, `Autumn Warm`, `Amber · Lavender · Black tea`) |
