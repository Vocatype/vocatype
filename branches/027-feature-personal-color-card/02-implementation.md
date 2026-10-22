# 027 feature/personal-color-card — 구현 문서

## 요약

공유 카드(저장 이미지)를 시안 A 2번째 형태로 고정했다. 기본 테마(어두운 바탕·흰 글자·흰 축 막대)는 모든 타입이 같고, 퍼스널 컬러 톤은 **아우라**(초상 뒤 두 겹 번짐), **원형 파형**, 색 원 5개에만 들어간다. 결과 화면의 사운드 시그니처도 퍼스널 컬러 톤 고리로 바뀌었다(라이트/다크에 맞춰 어둡게/밝게). 한쪽만 튀어나오던 고리는 정규화를 바꿔 고르게 찬다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/features/signature/signature.ts` | `resampleEnvelope`: 95번째 백분위수를 1로, 그 위는 1로 자르고 제곱근(`SIGNATURE_PERCENTILE`). `signatureColors(palette, count, 'dark' \| 'light')` 추가 |
| `src/features/signature/contrast.ts` | `mixHex` 추가(두 색 섞기) |
| `src/components/SoundSignature.tsx` | `colors`(막대별 색) prop. 주면 안쪽 원을 그리지 않는다 |
| `src/screens/ResultScreen.tsx` | 사운드 시그니처 카드에 `signatureColors(팔레트, 막대 수, useTheme().resolved)`. 저장 카드 라벨에서 쓰지 않는 값 제거 |
| `src/features/export/renderCard.ts` | `drawCard` 새 배치(아래 표). `CardLabels`에서 `signature`·`match`·`top`·`middle`·`base`·`stats` 삭제. 자리표시 초상의 고리는 한 가지 잉크색 유지 |
| `src/features/export/renderCard.test.ts` | 새 배치 기준으로 다시 씀(16타입 × ko/en 위치·궁합 이름과 라벨 겹침 없음·제거한 내용 미표시·캡션 위치·하단 한 줄·최악 조합 예산·축 말줄임·신호 부족 시 축 생략) |
| `src/features/signature/signature.test.ts` | 튀는 값 정규화, `signatureColors`(길이, 첫 색, 4색 순서, 다섯째 미사용, 빈 입력) |
| `src/screens/ResultScreen.test.tsx` | `ThemeProvider`로 감싼다(결과 화면이 `useTheme`을 쓴다) |

### 저장 카드 배치 (1080×1920)

| 요소 | 값 |
| --- | --- |
| 아우라 | (540, 390) 반지름 600, 팔레트 1번째 42% → 14% → 0, (620, 440) 반지름 380, 팔레트 2번째 30% → 0 |
| 상단 | 34px, 기준선 96 |
| 초상 | 420×420, y 150, 둥근 모서리 46, 흰 14% 테두리 |
| 코드·이름·캡션 | 코드 36px(초상 아래 90), 이름 72px 굵게 최대 2줄(줄 간격 84), 캡션 40px 1줄 |
| 축 | 2×2, 막대 폭 433, 줄 간격 96, 라벨 36px, 막대 흰 70%(퍼센트 없음) |
| 퍼스널 컬러 | 제목 34px, 계절 이름 48px 굵게, 원 반지름 30 간격 84(오른쪽 정렬) |
| 향 + 원형 파형 | 퍼스널 컬러 계절 이름 아래 134에 향 제목. 향 이름 42px 굵게 최대 2줄. 파형 반지름 110(안쪽 0.37), 막대 굵기 2.6, 향 블록 가운데 높이 |
| 궁합 | 파형 아래, 두 줄(간격 60). 이름은 두 라벨 중 넓은 쪽 뒤 28px에서 시작, 1줄 말줄임 |
| 하단 | 30px 한 줄 "『제목』 낭독 · Vocatype"(제목이 없으면 "Vocatype · 태그라인"), 기준선 1858 |

## 설계 대비 달라진 점

| 설계·시안 | 구현 | 이유 |
| --- | --- | --- |
| 궁합은 향 옆, 파형 왼쪽(시안) | 파형 **아래**에서 가로 폭 전체 | 영어 라벨("Polar opposite")이 길어 파형 왼쪽 폭에서는 영어 이름이 말줄임됐다. 파형 아래로 내려 이름 폭을 확보했다 |
| 하단 34px(시안 비율) | 30px | 영어 시 제목("Reading of “I Wandered Lonely as a Cloud”")이 34px에서 말줄임됐다 |
| 파형 막대 굵기 3.5(첫 구현) | 2.6 | 실제 렌더에서 막대 180개가 붙어 덩어리처럼 보였다(바깥 둘레 간격 약 3.8px) |

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` / `lint` / `build` | 종료 코드 0 |
| `npm test` | 종료 코드 0, 37 파일 290 테스트 |

### 구현자 확인 (실제 `drawCard` 렌더)

개발 서버에 임시 미리보기 페이지(확인 뒤 삭제)를 두고 실제 `presentResult` + `drawCard`로 그린 캔버스를 headless Chrome으로 1080×1920 캡처했다.

- **WFQV 한국어 + 실제 초상**(운영에서 만든 WFQV 초상): 시안과 같은 구성. 아우라는 벽돌·머스터드로 부드럽게 번지고, 파형은 벽돌 → 머스터드 → 올리브 → 갈색 순서로 돈다. 튀는 한 순간(합성 포락선에 넣은 큰 값)이 있어도 고리가 고르게 찬다
- **CLMV 영어 + 자리표시 초상**: 영어 이름 1줄, 궁합 이름이 라벨과 겹치지 않고 말줄임 없이 그려짐, 하단 한 줄. 자리표시 초상의 고리는 한 가지 잉크색
- **결과 화면 고리(SoundSignature)**: 흰 바탕에서는 어둡게 한 톤, 어두운 바탕에서는 밝힌 톤으로 둘 다 잘 보인다

## 알려진 한계

- 결과 화면의 고리 색은 테마를 바꾸면 다시 그려지지만, 저장 이미지는 항상 어두운 바탕 기준이다(의도).
- 실제 녹음 포락선으로 고리 모양을 본 것은 합성 포락선뿐이다. 운영에서 실제 녹음으로 한 번 더 본다.
- 사운드 시그니처 문구의 "당신만의"는 그대로다(별도 작업).

## 배포 후 확인

사용자 확인 뒤 2026-10-22 12:15:26 KST에 main(`d9d5432`)을 푸시했다(`origin`은 SSH). Cloudflare Workers Builds가 자동 배포했다: GitHub 커밋 검사 "Workers Builds: vocatype — completed/success"(03:18:17Z), 배포 기록 03:18:10Z, 버전 `f4080844-71da-46ef-88bc-582e63c7fdfe`. 배포 주소의 번들이 12:18:20 KST에 새 빌드(`index-DijGa0wH.js`)로 바뀌었다(푸시 뒤 약 3분).

12:18:33 KST, `https://vocatype.hs827.workers.dev`:

| 확인 | 결과 |
| --- | --- |
| `GET /`, `GET /api/health` | 200, 200 |
| `GET /api/config` | `textProviders: ["claude","workers-ai"]`, 초상·해설 켜짐 |
| 배포된 JS에 새 카드 코드 | 새 색 `#9f9a92`(라벨), `#d9d4cc`(본문 보조), 초상 테두리 `rgba(255, 255, 255, 0.14)`, 축 막대 `rgba(255, 255, 255, 0.7)` 있음. 옛 카드의 회색 `#b5afa6` 없음 |

- 실제 녹음으로 저장 이미지를 만드는 확인은 마이크가 있어야 해서 하지 않았다. 같은 코드로 그린 카드는 구현자 확인(실제 `drawCard` 렌더)에서 봤다. 운영에서 실제 녹음 한 번과 iPhone Safari 실기기 확인이 남아 있다.
