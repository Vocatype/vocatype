# 032 chore/license — 설계 문서

## 변경 사유

사용자 결정(2026-10-29): 저장소에 라이선스를 넣는다. 코드와 아이디어는 우리 것이고, 코드는 공개하되 **비상업적 사용은 허용, 상업적 이용은 금지**한다.

## 라이선스 선택

| 후보 | 판단 |
| --- | --- |
| **PolyForm Noncommercial 1.0.0** | **채택.** 비상업 목적이면 사용·수정·재배포를 허용하고 상업 목적은 허용하지 않는다. 소프트웨어용으로 변호사들이 만든 표준 문구이고 SPDX ID(`PolyForm-Noncommercial-1.0.0`)가 있다 |
| PolyForm Strict 1.0.0 | 수정·재배포까지 금지한다. 사용자 요구("비상업 가능")보다 좁다 |
| CC BY-NC 4.0 | 조건은 비슷하지만 Creative Commons가 소프트웨어에는 권하지 않는다 |
| MIT·Apache 2.0 등 오픈소스 | 상업 이용을 허용하므로 맞지 않는다(상업 금지 조건이 붙으면 OSI 기준 오픈소스가 아니다) |

## 범위

### 포함

- `LICENSE.md`(새 파일): 첫 줄에 `Required Notice: Copyright (c) 2026 Vocatype (https://github.com/Vocatype/vocatype)`, 그 아래 PolyForm 공식 저장소(`polyformproject/polyform-licenses`)의 원문을 그대로 넣는다
- `package.json`: `"license": "PolyForm-Noncommercial-1.0.0"`. `package-lock.json` 의 루트 항목도 같이 맞춘다
- `README.md`: "라이선스" 절(허용·금지 범위 요약, 재배포 때 원문과 `Required Notice:` 줄 전달, 의존성은 각자의 라이선스, 이름·아이디어는 저작권 라이선스로 보호되지 않음)

### 제외

- 소스 파일마다 머리 주석을 넣지 않는다. 저장소 단위 `LICENSE.md` 와 `package.json` 으로 충분하다
- 지난 커밋의 라이선스 소급 문제는 다루지 않는다(지금까지 라이선스 파일이 없어 기본 저작권 상태였다)

## 결정과 근거

| 결정 | 근거 |
| --- | --- |
| 저작권자 `Vocatype` | 사용자가 따로 정하지 않아 서비스 이름이자 GitHub 조직 이름으로 넣었다. 개인 이름이나 법인명으로 바꾸려면 `LICENSE.md` 첫 줄과 README 한 줄만 고치면 된다 |
| 원문 무수정 | 표준 라이선스는 문구를 바꾸면 표준이 아니게 된다. 저작권자 정보는 원문이 정한 방식(`Required Notice:` 줄)으로만 더한다 |
| 파일 이름 `LICENSE.md` | 원문이 Markdown이다. GitHub는 `LICENSE.md` 를 라이선스 파일로 보여 준다 |

## 검증 계획

1. `LICENSE.md` 본문이 공식 원문과 바이트 단위로 같은지(첫 줄 제외) 비교
2. typecheck / lint / test / build 종료 코드 0, `package-lock.json` 변경은 루트 `license` 한 줄뿐인지 확인
3. 독립 리뷰 → 병합 가능이면 `--no-ff` 병합

이 문서는 법률 자문이 아니다. 상업적으로 중요한 판단은 전문가 확인을 권한다.
