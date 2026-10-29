# 032 chore/license — 구현 문서

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `LICENSE.md` (새 파일) | 첫 줄 `Required Notice: Copyright (c) 2026 Vocatype (https://github.com/Vocatype/vocatype)`, 빈 줄, PolyForm Noncommercial 1.0.0 원문 |
| `package.json` | `"license": "PolyForm-Noncommercial-1.0.0"` |
| `package-lock.json` | 루트 항목에 같은 `license` 한 줄(`npm install --package-lock-only`, 다른 변경 없음) |
| `README.md` | "작업 흐름" 앞에 "라이선스" 절 |

## 원문 출처

`gh api repos/polyformproject/polyform-licenses/contents/PolyForm-Noncommercial-1.0.0.md`(PolyForm 프로젝트의 공식 GitHub 저장소, 4,563바이트, 2026-10-29, blob `5ecc88cfc4b1cff608ed640efe913c9dd97935c3`, 브랜치 `1.0.0`, 마지막 변경 `9c032bcb6b` 2020-05-14). `raw.githubusercontent.com` 직접 요청은 이 환경에서 네트워크 오류(curl 56)가 나서 GitHub API로 받았다.

## 설계 대비 달라진 점

없음.

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| `LICENSE.md` 3행부터와 공식 원문 `cmp` | 같음 |
| `npm run typecheck` / `lint` / `build` | 종료 코드 0 |
| `npm test` | 38파일 317건 통과 |
| `git diff --check` | 공백 문제 없음 |

빌드 산출물(클라이언트·Worker 코드)은 바뀌지 않는다. 라이선스는 저장소 파일과 패키지 정보만 바꾼다.

## 확인하지 못한 것

- 저작권자 이름: `Vocatype` 으로 넣었고, 사용자가 "저작권자 먼저 바꾸기" 대신 "리뷰 후 병합"을 골라 유지했다. 개인 이름·법인명으로 바꾸려면 `LICENSE.md` 첫 줄과 README 한 줄을 바꾼다. Vocatype이 법적 주체가 아니면 licensor가 누구인지 모호할 수 있다(불확실).
- GitHub는 PolyForm을 알아보지 못해 "Other"(NOASSERTION)로 표시한다(Licensee 대조 목록에 PolyForm 없음, PolyForm NC 공개 저장소 5곳 모두 NOASSERTION — 1차 리뷰 #6). 첫 줄 유무와 무관하며, 라이선스 이름은 README와 `package.json` 으로 알린다.
- 상업 이용 허락을 받을 연락 경로는 README에 없다(사용자가 정할 일).
- AI 도구로 만든 부분의 저작권 성립 범위는 법적으로 불확실하다. 라이선스는 저작권이 성립하는 범위에서만 효력이 있다(법률 자문 아님).
