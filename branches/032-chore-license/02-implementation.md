# 032 chore/license — 구현 문서

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `LICENSE.md` (새 파일) | 첫 줄 `Required Notice: Copyright (c) 2026 Vocatype (https://github.com/Vocatype/vocatype)`, 빈 줄, PolyForm Noncommercial 1.0.0 원문 |
| `package.json` | `"license": "PolyForm-Noncommercial-1.0.0"` |
| `package-lock.json` | 루트 항목에 같은 `license` 한 줄(`npm install --package-lock-only`, 다른 변경 없음) |
| `README.md` | "작업 흐름" 앞에 "라이선스" 절 |

## 원문 출처

`gh api repos/polyformproject/polyform-licenses/contents/PolyForm-Noncommercial-1.0.0.md`(PolyForm 프로젝트의 공식 GitHub 저장소, 4,563바이트, 2026-10-29). `raw.githubusercontent.com` 직접 요청은 이 환경에서 네트워크 오류(curl 56)가 나서 GitHub API로 받았다.

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

- 저작권자 이름: 사용자가 따로 정하지 않아 `Vocatype` 으로 넣었다. 개인 이름·법인명이 맞다면 `LICENSE.md` 첫 줄과 README 한 줄을 바꾼다.
- GitHub 저장소 화면이 이 파일을 PolyForm으로 인식해 표시하는지는 병합 뒤에 본다.
