# 005 feature/result — 설계 문서

## 목표

분석 프로필을 결과 카드로 보여 주고, 모든 요소를 세로 이미지 한 장(1080×1920 PNG)으로 저장할 수 있게 한다.
얼굴 이미지는 006의 AI 어댑터가 채우며, 이 작업에서는 자리표시 초상(퍼스널 컬러 그라디언트 + 사운드 시그니처)을 그린다.

## 범위

### 포함

- `src/features/profile/present.ts`: 프로필 + 로케일 → 화면·이미지가 함께 쓰는 `ResultView`(문구가 모두 현재 언어로 풀린 값)
- `src/features/signature/signature.ts`: 에너지 포락선 → 180개 방사형 막대 좌표(SVG와 캔버스가 공유)
- `src/components/SoundSignature.tsx`: 원형 파형 SVG
- `src/components/PortraitFrame.tsx`: 초상 이미지가 있으면 표시, 없으면 자리표시 초상
- `src/features/export/renderCard.ts`: 캔버스에 카드 전체를 그려 PNG Blob 생성 (텍스트 줄바꿈, 스와치, 서명, 초상 포함)
- `src/features/export/save.ts`: 다운로드(`<a download>`), 지원 시 Web Share API(`navigator.canShare({ files })`)
- `src/screens/ResultScreen.tsx`: 카드 섹션(타입, 퍼스널 컬러, 향, 사운드 시그니처, 궁합), 저장·공유·다시 하기·처음으로, 신호 부족 안내
- `src/App.tsx`: `profile`·`portrait` 상태를 결과 화면에 전달 (`portrait`는 006 전까지 `null`)
- 메시지, 스타일, 단위 테스트(present, signature, 줄바꿈)

### 제외

- 실사 초상 생성 (006)
- 결과 URL 공유·서버 저장 (개인정보 원칙상 하지 않음)

## 화면 구성 (세로 스크롤)

```
[● 녹음 ● 생성 ● 결과]
나의 목소리 초상
『서시』 낭독 · 0:12

┌ 초상 카드 ───────────────────────┐
│ [초상 1:1]                        │
│ WFQV                             │
│ 불꽃 이야기꾼                      │
│ 설명 두 문장                       │
│ 따뜻한 · 꽉 찬 · 빠른 · 생동하는   │
└──────────────────────────────────┘
퍼스널 컬러  가을 웜   ■ ■ ■ ■ ■ (hex)
시그니처 향  앰버 · 자스민 · 베르가못
             탑 / 미들 / 베이스 노트, 무드 한 줄
사운드 시그니처  (원형 파형)  평균 음높이 142Hz · 분당 250음절
궁합  최고의 짝: 캠프파이어 시인(WLMV)  반대: 서리 내린 아침의 서점 주인(CLME)
[이미지로 저장] [공유]   [다시 하기] [처음으로]
이 결과는 재미로 보는 해석이에요. 녹음은 저장되지 않았어요.
```

## 저장 이미지 (1080×1920)

| 영역 | 내용 |
| --- | --- |
| 배경 | 어두운 바탕 위에 퍼스널 컬러 대표색 그라디언트 |
| 상단 | 서비스 이름, 타입 코드 |
| 초상 | 560×560 둥근 사각형. 이미지가 없으면 자리표시 초상 |
| 타입 | 이름(큰 글씨), 설명(줄바꿈), 축 네 개 |
| 퍼스널 컬러 | 계절 이름, 스와치 5개와 hex |
| 향 | 이름, 노트 3줄 |
| 사운드 시그니처 | 원형 파형 |
| 궁합 | 최고의 짝, 반대 타입 |
| 하단 | 낭독한 작품, 날짜, 서비스 이름 |

캔버스 텍스트 줄바꿈은 한국어는 글자 단위, 영어는 단어 단위로 자른다. 시스템 폰트 스택을 쓴다(외부 폰트 요청 없음).

## 인터페이스

```ts
interface ResultView { code; name; description; axisLabels: string[]; color: {...}; scent: {...}; signature: number[]; stats: { pitchHz; syllablesPerMinute; durationMs }; match: {...}; quality }
presentResult(profile, capture, locale): ResultView
signatureBars(values, cx, cy, innerR, outerR): Bar[]
renderCard(view, portraitImage: HTMLImageElement | null, options: { serviceName; locale; date }): Promise<Blob>
saveImage(blob, filename): Promise<'downloaded' | 'shared' | 'cancelled'>
<ResultScreen capture profile portrait onNavigate />
```

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| 화면과 이미지가 같은 `ResultView`를 사용 | 화면에 보이는 것과 저장되는 것이 어긋나지 않게. 문구 치환을 한 번만 한다. |
| 사운드 시그니처는 004의 `envelope`로 그림 | 결과 화면에서 오디오를 다시 디코딩하지 않는다. 포락선 180빈이면 지문처럼 보이고 데이터도 작다. |
| 캔버스 직접 그리기 (html2canvas 등 미사용) | 의존성 없이 결정적인 결과. 외부 폰트·이미지가 없어 캔버스 오염(taint) 걱정이 없다. |
| 공유 API는 가능할 때만 노출 | iOS Safari는 `download` 속성이 새 탭으로 열리므로 공유 시트가 더 자연스럽다. |
| 날짜는 이미지에 넣되 시간·기기 정보는 넣지 않음 | 공유용 기념 정보이며 개인 식별과 무관하다. |

## 검증 계획

1. typecheck / lint / test / build 통과
2. 브라우저: 합성 녹음 → 분석 → 결과 화면 모든 섹션 렌더링(라이트/다크, 375px/PC, ko/en), 저장 버튼으로 PNG 다운로드, 저장 이미지 내용 확인
3. `quality: 'low-signal'`일 때 안내 문구 표시
