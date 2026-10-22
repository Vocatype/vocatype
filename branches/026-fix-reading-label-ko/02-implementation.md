# 026 fix/reading-label-ko — 구현 문서

## 요약

결과 화면 해설 카드의 한국어 제목을 "목소리 리딩"에서 "목소리 해설"로 바꿨다. 화면에 보이는 한국어 중 "리딩"이 들어간 문구는 이것 하나였다. README는 기능을 소개하는 문장을 같은 말로 맞추고, 코드·API에서는 `reading`(리딩)이라는 이름을 그대로 쓴다는 안내를 한 줄 더했다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/i18n/messages/ko.ts` | `result.section.reading`: "목소리 리딩" → "목소리 해설" |
| `README.md` | 첫 소개, 개인정보 원칙(해설 요청·"초상·해설 생성 속도 제한"), 텍스트 제공자 절 제목과 첫 문단, 알려진 한계의 "목소리 리딩"·"리딩 카드" → "목소리 해설"·"해설 카드". 텍스트 제공자 절에 위치와 무관한 용어 안내 한 줄("README에서 '리딩'은 이 기능을 가리킨다") |

코드 식별자·주석·테스트 이름, 영어 문구, AI 프롬프트, 과거 `branches/` 문서는 바꾸지 않았다(01 "제외").

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` | 종료 코드 0 |
| `npm run lint` | 종료 코드 0 |
| `npm test` | 종료 코드 0, 37 파일 285 테스트 |
| `npm run build` | 종료 코드 0 |
| 결과 화면 정적 렌더 | `ResultScreen.test.tsx`의 리딩 표시 테스트(같은 언어면 해설 카드 제목이 보이고, 다른 언어면 안 보임)가 키로 문구를 읽어 새 문구로 통과 |
| 빌드 번들 | `dist/client/assets/index-B-Ob9t2h.js`에 "목소리 해설" 1회, "목소리 리딩" 0회 |
| 저장소 검색 | 화면 문구(`src/i18n/messages/ko.ts`)에 "리딩" 없음. 남은 "리딩"은 코드 주석·테스트 이름·README의 기술 설명(용어 안내가 README 전체에 적용)·과거 문서뿐 |

## 배포 후 확인

2026-10-22 10:44 KST에 main(`1cd5e08`)을 푸시했다.

- `origin` 원격이 `https://github.com/Vocatype/vocatype.git`(조직으로 옮겨진 저장소)로 바뀌어 있었고 HTTPS 자격 증명이 없어 `git push origin`이 실패했다("could not read Username"). 같은 저장소에 SSH로 푸시했다(`git push git@github.com:Vocatype/vocatype.git main:main`). 원격 설정은 바꾸지 않았다.
- **자동 배포가 일어나지 않았다.** 푸시 뒤 4분 동안 배포 주소의 번들이 그대로였고(`index-np10x9bi.js`), 마지막 배포 기록은 2026-10-20 07:12:45Z(`4addb30` 문서 푸시)였다.
- 원인: GitHub의 커밋 검사 기록에서 `4addb30`에는 Cloudflare의 "Workers Builds: vocatype — completed/success"가 있지만 `1cd5e08`에는 아무 검사도 없다. 저장소가 `hyunseop827/vocatype`에서 `Vocatype` 조직으로 옮겨지면서 Cloudflare Workers Builds가 푸시를 받지 못하는 것으로 본다.
- 따라서 이 시점 운영 화면은 아직 "목소리 리딩"이다. 반영은 (1) Cloudflare 대시보드에서 Git 연결을 `Vocatype/vocatype`로 다시 하거나, (2) `npm run deploy`로 직접 배포하면 된다. 반영 뒤 결과를 이 절에 덧붙인다.
