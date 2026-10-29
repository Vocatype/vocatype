# 035 feature/portrait-variety — 구현 문서

작업 브랜치: `claude/ai-model-migration-e64f72`(앱이 만든 worktree 브랜치). 병합할 때 `feature/035-portrait-variety` 를 만들어 `--no-ff` 로 병합한다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `worker/ai/portraitPrompt.ts` (새 파일) | `buildPortraitPrompt({ typeCode, axes, seed })`, 연출 후보 `STAGING`(각도 4·구도 3·배경 4·옷 5·머리 6·소품 3), 그림 의미 축 `MOOD_AXES`(다섯, 음높이 없음), 씨앗과 항목 번호를 섞어 고르는 `pickFor` |
| `shared/catalog.ts` | 옛 `buildPortraitPrompt` 삭제(서버 전용이라 옮김). 퍼스널 컬러의 `promptColors` 는 새 프롬프트가 그대로 쓴다 |
| `shared/api.ts` | `PortraitRequest.axes`(여섯 축), 씨앗 주석, 본문 상한 주석 |
| `worker/reading.ts` | 축 검증을 `validateAxes` 로 떼어 내보냄(리딩·초상이 함께 씀) |
| `worker/portrait.ts` | `axes` 필수 검증(없거나 범위 밖이면 400), 반올림 |
| `worker/index.ts` | `buildPortraitPrompt(parsed.value)` |
| `src/features/ai/generate.ts` | 반올림한 축(`toReadingAxes`)을 한 번 만들어 초상·리딩 요청에 함께 넣음 |
| `README.md` | 개인정보 원칙·보내는 데이터·프롬프트 설명·알려진 한계(씨앗과 얼굴), 예시 `curl` 두 곳에 `axes` |
| 테스트 | 아래 |

| 테스트 파일 | 내용 |
| --- | --- |
| `worker/ai/portraitPrompt.test.ts` (새 파일) | 결정성, 같은 타입·축에서 씨앗 2,000개 → 서로 다른 문장 1,000개 이상과 모든 후보 등장, 다섯 축 줄의 형식(두 자리, 0·1의 뜻), 음높이·음높이 값 없음, 금지 지시, 타입 영어 이름·글자 금지 지시, 타입 코드·씨앗 숫자 없음, 16타입 × 씨앗 43개 금지어·실사·색 코드 없음, `pickFor` 항목 독립성 — 6건 |
| `worker/portrait.test.ts` | 축 필수·누락·범위·문자열·반올림·추가 키, 가장 큰 정상 요청이 1KB 안 |
| `worker/index.test.ts` | 요청 본문에 `axes`. OpenAI 본문에 타입 코드 없음, 프롬프트에 `lighting warmth: 0.80` 과 타입 영어 이름, `pitch` 없음 |
| `src/features/ai/client.test.ts`, `generate.test.ts` | 초상 요청에 리딩과 같은 반올림 축 |
| `shared/catalog.test.ts` | 옛 프롬프트 테스트를 `portraitPrompt.test.ts` 로 옮김 |

## 만들어지는 문장(예시)

WFQV, 축 `{ warmth: 0.82, density: 0.71, pace: 0.77, variation: 0.68, pitch: 0.38, brightness: 0.45 }`, 씨앗 2837461920:

```
Photorealistic portrait photograph of one person looking at the camera.
glancing back over the shoulder, close-up framing, plain softly blurred studio backdrop.
wearing a denim jacket in deep brick red and mustard tones, small earrings, curly hair.
Overall feeling inspired by the title "The Fireside Storyteller" — use it only as a mood; do not show any text, letters or logos in the image.
Mood values from 0 to 1. Use them only for light, color and mood, never to decide the person's gender, age or ethnicity:
- lighting warmth: 0.82 (0 = cool bluish daylight, 1 = deep golden light)
- color richness: 0.71 (0 = pale, airy colors, 1 = deep, saturated colors)
- sense of motion: 0.77 (0 = perfectly still pose, 1 = caught mid-movement)
- expression liveliness: 0.68 (0 = calm, serene expression, 1 = animated expression, mid-laugh)
- overall brightness: 0.45 (0 = dark, low-key image, 1 = bright, high-key image)
85mm lens, shallow depth of field, natural skin texture, high detail, editorial photography.
```

같은 축에 씨앗 123이면 둘째·셋째 줄이 `face turned slightly to one side, close-up framing, plain softly blurred studio backdrop.` / `wearing a linen shirt in deep brick red and mustard tones, a close buzz cut.` 로 바뀐다.

## 설계 대비 달라진 점

없음.

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` / `lint` / `build` | 종료 코드 0 |
| `npm test` | 40파일 332건 통과 |
| `git diff --check` | 공백 문제 없음 |

변이 확인(관련 테스트만 실행, 확인 뒤 원래대로 되돌리고 `cmp` 로 같음 확인):

| 변이 | 실패한 테스트 |
| --- | --- |
| `pickFor` 가 항목 번호를 무시 | 2건 |
| 음높이 줄 추가 | 1건 |
| 성별·나이·인종 금지 지시 삭제 | 1건 |
| 타입 이름 줄 삭제 | 1건 |
| 축 없는 요청 통과 | 1건 |
| 클라이언트가 축을 보내지 않음 | 1건 |

## 확인하지 못한 것

- 실제로 얼굴이 얼마나 다양해지는지. 배포 뒤 사용자가 여러 번 녹음해 본다(장당 약 $0.0136).
- 문장이 길어져 입력 토큰이 늘었다(약 80 → 약 250토큰 추정). 입력 단가는 100만 토큰당 $5라 장당 약 $0.001 미만이 더 든다. 배포 뒤 `[portrait] openai … in=…` 로그로 확인한다.
- 축이 없는 옛 클라이언트 탭은 400 → 자리표시 초상이다. 새로 고치면 된다.
- Workers AI(Lucid Origin)로 되돌렸을 때 긴 여러 줄 프롬프트가 잘 먹히는지는 보지 않았다(지금 운영은 OpenAI).
