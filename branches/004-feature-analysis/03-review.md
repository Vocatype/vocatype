# 004 feature/analysis — 리뷰 문서

리뷰 대상: `feature/004-analysis` → `main` 전체 diff.
리뷰 방식: 신호 처리 지식이 있는 별도 리뷰 에이전트가 설계·구현 문서와 코드를 읽고 검증 명령을 실행했으며, DSP 모듈을 Node로 복사해 합성 신호(약한 기본음, 자음+모음 음절, 쉼) 실험을 수행. 구현자가 결과를 반영.

## 1차 리뷰

### 체크리스트

| 항목 | 결과 |
| --- | --- |
| DSP 정확성 | **결함 발견** (M2 옥타브 오류), 성능 30초 375ms(M시리즈 Node) |
| 축 사상의 실제 화자 타당성 | **결함 발견** (C1 밀도·속도 쏠림, M1 온도 성별 상관) |
| 카탈로그 품질 | 노트 순서·프롬프트 색 표기·이름 몇 개 개선 필요 |
| React 수명주기 | 취소가 연산을 멈추지 않음 (M3). 나머지 견고 |
| 타입·테스트·문서 | 테스트 공백, 문서 수치 표현 보완 |
| typecheck / lint / test / build | 모두 통과 |

### 발견 사항과 조치

| # | 심각도 | 위치 | 내용 | 조치 (커밋 `6165f8f`) |
| --- | --- | --- | --- | --- |
| C1 | critical | `features.ts`, `axes.ts` | 밀도가 유성(피치 잡힌) 프레임만 세어 자음·숨·쉼이 30~50%인 실제 말에서 전부 L. 속도는 봉우리를 구간 전체에서 세고 유성 시간으로 나눠 1.25~1.3배 부풀려 전부 Q. 16타입이 2~4개로 수렴 | 밀도 = 에너지 프레임 비율(0.6~0.95). 속도 = 봉우리/에너지 시간 + 돌출도 조건, 범위 한국어 3.5~7 / 영어 2.5~5.5(낭독 언어 전달). 자음·쉼이 있는 말소리형 합성 신호 4종 테스트 추가 |
| M1 | major | `axes.ts` | 피치 85~255Hz 로그 + 0.6 가중이라 온도 축이 성별 분류기가 됨 | 밝기를 진폭 가중 스펙트럼 기울기로 바꾸고 가중을 0.4(pitch)/0.6(brightness)로 |
| M2 | major | `dsp.ts` | 기본음 약하고 2배음 강한 신호에서 2배 피치(신뢰도 0.9) | 2τ±2 근처에 절반 이하로 깊은 최소가 있으면 선택하는 옥타브 검사(dip이 0.03보다 얕을 때만). 테스트 추가(약한 기본음 95Hz, 순음 190Hz 유지) |
| M3 | major | `GeneratingScreen.tsx`, `features.ts` | `cancelled` 플래그는 콜백만 막아 취소 뒤에도 분석이 끝까지 돎 | `AbortSignal`을 `analyzeRecording → extractFeatures`에 전달, 양보 지점마다 `throwIfAborted`. 화면은 `AbortController`로 취소 |
| m1 | minor | `decode.ts` | 44.1k 디코딩 후 상자 필터 리샘플이 치찰음을 접어 밝기를 흔듦 | 16kHz `OfflineAudioContext`로 디코딩(폴백 44.1k) |
| m2 | minor | `dsp.ts` | DC·럼블 제거 없음 | 1차 하이패스(≈50Hz) |
| m3 | minor | `features.ts` | 무성 프레임에서 양보를 건너뜀 | 양보 검사를 `continue` 앞으로 |
| m4 | minor | `dsp.ts` | 모든 τ를 계산 | dip 이후 2τ+2까지만 계산 |
| m5 | minor | `catalog.ts` | "무거운 앞쪽 노트" 주석과 목록 순서 불일치 | 탑·베이스 목록을 무거운 순으로 정렬 |
| m6 | minor | `catalog.ts` | 프롬프트의 hex·퍼스널 컬러 용어는 텍스트 인코더에 무의미 | 계절별 `promptColors`("soft coral and peach" 등) |
| m7 | minor | `catalog.test.ts` | 금지어가 공백 의존, 누락 많음 | 단어 경계 정규식(woman/man/male/female/girl/boy/lady/child/teen/young/old/elderly/인종어), hex 금지 |
| m8 | minor | 테스트 | 비정수 리샘플·무성 혼합·쉼·옥타브 미검증 | 모두 추가 |
| n1 | nit | `typeCode.ts` | 미사용 `AXIS_LETTERS` | 삭제 |
| n2 | nit | `features.ts` | `\|\| 0`, 중첩 `setTimeout(0)` 4ms 클램프 | 정리, `scheduler.yield`/MessageChannel |
| n3 | nit | 문서 | "200ms(약 6프레임)" 창 겹침 미반영, "수백 ms"가 데스크톱 기준 | "약 220ms 이상", 데스크톱 기준 명시 |
| n4 | nit | `GeneratingScreen.tsx` | 진행 막대가 퍼센트만 읽힘 | `aria-valuetext`에 단계 문구 |
| n5 | nit | `catalog.ts` | 수다쟁이/서리 내린 아침의/유리 같은, CLQE "feel warm" | 봄바람 전령 / 서리 아침의 서점 주인 / 유리알 해설자, "feel easy" |

### 1차 결론

**수정 필요.** C1·M1·M2·M3 반영 후 2차 리뷰. (m1~n5도 같은 커밋에 반영. 실녹음 분포 보정은 마이크가 필요해 "알려진 한계와 보정"으로 문서화)

### 1차 반영 후 구현자 확인

- typecheck / lint / test(69) / build 통과
- 브라우저, 말소리형 합성 스트림(자음 잡음 + 배음 모음 + 8음절마다 0.4초 쉼): 120Hz·4.5음절/초 → `WFME`(density 0.65, pace 0.28, brightness 0.30), 220Hz·6음절/초 → `CFQE`(density 0.54, pace 0.72, brightness 0.65). 밀도·속도·온도가 입력에 따라 갈림
