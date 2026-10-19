# 005 feature/result — 리뷰 문서

리뷰 대상: `feature/005-result` → `main` 전체 diff.
리뷰 방식: 별도 리뷰 에이전트가 설계·구현 문서와 코드를 읽고 검증 명령을 실행했으며, 개발 서버에서 `renderCard`를 ko/en × 짧은/긴 이름 네 경우로 직접 호출해 `fillText` 좌표를 기록·캡처로 검증. 구현자가 결과를 반영.

## 1차 리뷰

### 체크리스트

| 항목 | 결과 |
| --- | --- |
| 캔버스 레이아웃 | **치명 결함** (1, 2) |
| 공유 흐름 | 사용자 제스처 만료 (3) |
| 접근성 | 저장 중 초점 유실(4), `p aria-label`, 중첩 `role=img` |
| 개인정보 | 문제 없음 (네트워크·저장소 없음, 이미지에는 날짜·타입 코드만) |
| i18n | 영어 단위 띄어쓰기 |
| CSS 375px | 스와치 hex 폭 빠듯, 320px 넘침 |
| 문서 | 검증 기록이 사실과 다름 |
| typecheck / lint / test / build | 모두 통과 |

### 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 (커밋 `dc52178`) |
| --- | --- | --- | --- | --- |
| 1 | critical | `renderCard.ts` | 세로 누적이 1860에 도달해 궁합 제목이 하단 문구 사이에, 짝·반대 이름은 1920px 밖(1924~2086)에 그려짐. 모든 타입·언어에서 이미지에 궁합이 없음. 구현 문서의 "모두 그려진 것을 확인"은 오기 | 커서 기반 레이아웃으로 재작성. 초상 520→420, 이름 2줄·설명 3줄·향 이름 2줄·노트 1줄 제한, 통계를 서명 아래로, 넘치면 예외. 가짜 2D 컨텍스트로 16타입 × ko/en 글자 좌표를 검사하는 테스트 추가 |
| 2 | critical | `renderCard.ts` | 영어 통계 한 줄이 우측 마진을 넘어 푸터 "Reading of…"와 교차 | 통계를 두 줄(`stats: string[]`)로 서명 아래 300px 폭 안에 |
| 3 | major | `ResultScreen.tsx`, `save.ts` | 1.5MB PNG 인코딩 뒤 `navigator.share`를 불러 transient activation이 만료되면 `NotAllowedError`를 "이미지를 만들지 못했어요"로 오안내 | 마운트 300ms 뒤 이미지를 미리 만들어 캐시(언어·초상 키). `NotAllowedError`는 "한 번 더 눌러 주세요"로 분기, 두 번째 클릭은 캐시로 즉시 공유 |
| 4 | major | `ResultScreen.tsx` | 저장 중 `disabled`로 키보드 초점이 body로 이동 | `aria-busy` + `aria-disabled`, 클릭 무시 |
| 5 | minor | `ResultScreen.tsx` | `<p aria-label>`은 금지 조합 | 숨김 `<span>` 라벨 |
| 6 | minor | `PortraitFrame.tsx` | `role="img"` 안의 SVG `role="img"`는 노출되지 않음 | SVG `aria-hidden`, `signatureTitle` prop 제거 |
| 7 | minor | `global.css` | 375px 스와치 hex 빠듯, 320px 넘침 | `repeat(5, minmax(0, 1fr))` + `overflow-wrap: anywhere` |
| 8 | minor | 자리표시 초상 | 봄 웜 팔레트 위 흰 막대가 거의 안 보임 | 팔레트 휘도로 어두운 선/흰 선 선택(`signatureInkFor`), 화면·캔버스 공용 |
| 9 | minor | `renderCard.ts` | 3자리 hex가 NaN | `hexToRgb`가 3·6자리 처리, 실패 시 회색 |
| 10 | minor | `renderCard.ts` | 노트 3줄이 줄바꿈 없이 그려짐, `wrapText` 중복 호출 | 노트 1줄 제한(말줄임), 줄 배열 재사용 |
| 11 | minor | `en.ts` | `142Hz` | `142 Hz` |
| 12 | minor | `ResultScreen.tsx` | 죽은 `className="result"`, 마운트 시 이미 있는 `notice`의 `role="status"` | 제거 |
| 13 | nit | 문서 | 설계 초상 560 vs 코드, "role=img + 제목" 표현, 존재하지 않는 리뷰 문서 참조 | 달라진 점 표에 기록, 표현 정정, 검증 결과 직접 기록 |

### 1차 결론

**수정 필요.** 1·2 수정과 경계 테스트 추가 후 2차 리뷰. (3~13도 같은 커밋에 반영)

### 1차 반영 후 구현자 확인

- typecheck / lint / test(93) / build 통과. 경계 테스트: 16타입 × ko/en 전부 글자 y ≤ 1800, x가 [72, 1008] 안, 궁합 이름 두 개가 그려짐
- 브라우저: 영어·한국어 저장 이미지(`WLQE`, 봄 웜) 1080×1920를 띄워 궁합 두 칸, 통계 두 줄, 하단 문구가 모두 캔버스 안에 있음을 확인. 밝은 팔레트 위 서명이 어두운 선으로 보임
