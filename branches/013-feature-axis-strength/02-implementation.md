# 013 feature/axis-strength — 구현 문서

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/features/profile/axisStrength.ts`, `.test.ts` | `axisStrengths(axes)`: 4축의 결정 글자·라벨·반대 라벨·퍼센트(50~100)·경계 여부. 순서는 타입 코드 글자 순서 |
| `src/features/profile/present.ts`, `.test.ts` | `axisLabels` 삭제, `axes: AxisStrengthView[]`(현재 언어로 풀림) |
| `src/screens/ResultScreen.tsx` | 칩 → 축 행 4개: 글자(장식) + 라벨 + 퍼센트, `role="meter"`(50~100) 막대, 경계면 "{other} 성향도 조금 있어요" |
| `src/features/export/renderCard.ts`, `.test.ts` | 칩 → 한 줄 네 개의 작은 막대(라벨 폭 제한, 퍼센트 우측 정렬, 바닥·채움 막대). 세로 소비 42→56px, 최악 조합 예산 테스트 통과 |
| `src/i18n/messages/{ko,en}.ts` | `result.axisBoundary` |
| `src/styles/global.css` | `.chips/.chip` → `.axes/.axis*`(모바일 1열, 520px 이상 2열) |

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| typecheck / lint / test(177) / build | 통과 |
| 결과 화면 (PC·다크·한국어, 합성 스트림 150Hz·5음절/초·강세 [1, 0.6]) | `WLQE`: W 따뜻한 75%, L 가벼운 51%(경계 → "꽉 찬 성향도 조금 있어요"), Q 빠른 60%, E 고른 82%. `role="meter"`의 `aria-label` "온도: 따뜻한 75%", `aria-valuenow` 75, 채움 너비 75% |
| 영어 전환 | "W Warm 75%", 경계 안내 "with a touch of Full" |
| 저장 이미지 | `vocatype-WLQE.png` 1080×1920. 설명 아래 한 줄에 네 막대(W 따뜻한 75% · L 가벼운 51% · Q 빠른 60% · E 고른 82%)가 그려지고 퍼스널 컬러 섹션과 겹치지 않음 |
| 모바일 375px · 라이트 | 축 행이 1열로, 라벨·퍼센트·막대·경계 안내가 가로 넘침 없이 표시 |
