# 002 feature/ui-main — 설계 문서

## 목표

사용자가 들어오자마자 보는 메인 화면과, 메인 → 녹음 → 생성 중 → 결과로 이어지는 화면 흐름의 뼈대를 만든다.
이후 003(녹음), 004(분석), 005(결과)는 이 흐름 안의 화면 하나씩을 채운다.

## 범위

### 포함

- `src/app/flow.ts`: 단계 타입 `FlowStep = 'landing' | 'record' | 'generating' | 'result'` 와 단계 전이 규칙
- `src/App.tsx`: 현재 단계 상태를 갖고 단계별 화면을 렌더링. 단계가 바뀌면 스크롤을 맨 위로 올리고 화면 제목에 초점을 옮김
- `src/screens/LandingScreen.tsx`: 로고, 서비스 이름, 태그라인, 3단계 안내, 시작 버튼, 소요 시간·개인정보 안내, 마이크 미지원 안내
- `src/screens/RecordScreen.tsx`, `GeneratingScreen.tsx`, `ResultScreen.tsx`: 자리표시 화면. 제목, 안내 문구, 뒤로/처음으로 버튼만 둔다
- `src/components/Screen.tsx`: 화면 공통 래퍼(제목 초점 관리, 진입 애니메이션)
- `src/components/StepIndicator.tsx`: 현재 단계를 보여주는 점 세 개(녹음·생성·결과)
- 메시지 키 추가 (ko/en)
- 단위 테스트: 단계 전이 규칙

### 제외

- 실제 녹음, 분석, 결과 렌더링 (003~005)
- 브라우저 뒤로가기(history) 연동. URL이 없는 단일 흐름이고, 녹음 중 뒤로가기로 상태가 꼬이는 것을 피하기 위해 화면 안의 버튼으로만 이동한다

## 화면 구성

```
┌──────────────────────────────┐
│ TopBar (로고 · 언어 · 테마)   │
├──────────────────────────────┤
│                              │
│         [로고 96px]           │
│        VoicePortrait          │
│    목소리로 그리는 나의 초상    │
│                              │
│  ① 짧은 글을 읽고 녹음해요     │
│  ② 목소리를 분석해요           │
│  ③ 나만의 초상 카드를 받아요    │
│                              │
│  [        시작하기        ]   │
│  약 1분 · 녹음은 저장되지 않아요│
│                              │
├──────────────────────────────┤
│ footer: 개인정보 안내          │
└──────────────────────────────┘
```

- 모바일: 세로 가운데 정렬, 시작 버튼은 가로 가득. PC: 같은 구성을 최대 너비 640px 안에 둔다.
- 마이크 API(`navigator.mediaDevices.getUserMedia`)가 없으면 시작 버튼을 비활성화하고 이유를 보여준다.

## 단계 전이 규칙

| 현재 | 이동 가능 | 트리거 |
| --- | --- | --- |
| landing | record | 시작하기 |
| record | landing, generating | 뒤로 / 생성하기(003) |
| generating | record, result | 취소 / 완료(004·005) |
| result | landing, record | 처음으로 / 다시 하기 |

`canTransition(from, to)`를 두고 `App`은 허용된 전이만 적용한다. 규칙을 한 곳에 두면 이후 작업에서 화면이 늘어도 흐름이 흩어지지 않는다.

## 인터페이스

```ts
// src/app/flow.ts
export type FlowStep = 'landing' | 'record' | 'generating' | 'result'
export const FLOW_ORDER: readonly FlowStep[]        // 단계 표시용 순서
export function canTransition(from: FlowStep, to: FlowStep): boolean

// 화면 컴포넌트 공통 props
interface ScreenProps { onNavigate: (to: FlowStep) => void }
```

## 주요 결정과 근거

| 결정 | 근거 |
| --- | --- |
| 라우터 없이 `useState<FlowStep>` | 화면이 넷뿐이고 URL 공유가 필요 없다. 라이브러리 추가는 번들과 복잡도만 늘린다. |
| 전이 규칙을 순수 함수로 분리 | 테스트 가능하고, 다음 작업들이 같은 규칙을 재사용한다. |
| 단계가 바뀔 때 제목에 초점 | 스크린리더 사용자가 화면 전환을 인지하도록. 시각 사용자에게는 outline이 보이지 않게 `tabIndex=-1` 요소에만 초점 |
| 마이크 미지원 사전 안내 | 녹음 화면까지 갔다가 실패하는 경험을 막는다. 권한 요청은 003의 녹음 화면에서 한다. |

## 검증 계획

1. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` 통과
2. 브라우저: 메인 렌더링(모바일·PC·라이트·다크), 시작하기 → 녹음 자리표시 화면 → 뒤로 → 메인, 단계 전환 시 제목 초점 이동
3. 한국어/영어 전환 시 모든 문구가 바뀌는지 확인
