# 015 docs/portrait-seed-check — 구현 문서

## 요약

배포 Worker(`https://vocatype.hs827.workers.dev`)에 같은 `{typeCode: "WFQV", seed: 123}`을 두 번, 대조군으로 `seed: 456`을 한 번 보냈다.
**같은 씨앗은 같은 얼굴·구도·조명**이 나왔고 응답 바이트만 달랐다(픽셀 차이 채널 평균 3/255). 다른 씨앗은 다른 사람·다른 구도였다(33/255).
즉 "같은 녹음이면 같은 얼굴"은 성립하고 모델 교체는 필요 없다. README의 `shasum` 비교 안내는 틀린 방법이라 눈·픽셀 비교로 바꿨다.

## 실측

2026-10-20 12:45~12:48 KST. 호출 전 `GET /api/config` → `{"provider":"workers-ai","textProviders":["workers-ai","claude"],"features":{"portrait":true,"reading":true}}`.
요청은 `curl -s -X POST …/api/portrait -H 'content-type: application/json' -d '{…}' -o respN.json`, 응답의 `image`(data URL)에서 base64를 풀어 JPEG로 저장했다.

| # | 본문 | 시각(KST) | 응답 | 소요 | JPEG | SHA-256(앞 8자리) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `WFQV` / `123` | 12:45:27 | 200, `provider: "workers-ai"`, `data:image/jpeg` 768×768 | 3.5초 | 258,616 B | `5b6ea9ab` |
| 2 | `WFQV` / `123` | 12:45:33 | 같음 | 3.5초 | 260,454 B | `51e15aa8` |
| 3 | `WFQV` / `456` | 12:48:29 | 같음 | 3.2초 | 245,053 B | `08c420d3` |

픽셀 비교(`sips -s format bmp`로 변환한 뒤 아래 스크립트, 768×768 RGB):

| 쌍 | 채널 평균 절대차(0~255) | 완전히 같은 픽셀 | 채널 최대차 >8 | 채널 최대차 >32 | 눈으로 |
| --- | --- | --- | --- | --- | --- |
| 1 vs 2 (같은 씨앗) | **3.06** | 18.8% | 10.5% | 2.0% | 같은 사람, 같은 자세·미소·옷·창 그림자. 머리카락 윤곽과 그림자 가장자리만 미세하게 다름 |
| 1 vs 3 (다른 씨앗) | **33.0** | 0.0% | 97.0% | 61.2% | 다른 사람, 정면 구도, 활짝 웃음, 배경색이 다름 |

## 해석

- 같은 씨앗 쌍의 차이(3.06)와 다른 씨앗 쌍의 차이(33.0)가 10배로 뚜렷이 갈리고 눈으로도 같은 사람이므로, 설계의 해석 규칙대로 **결정적**으로 판정한다. 바이트 불일치는 GPU 부동소수점 비결정성(과 JPEG 재인코딩) 수준이고, 차이가 큰 픽셀 2%는 머리카락 가장자리·그림자 경계에 몰려 있다.
- 씨앗이 구도(측면 → 정면)까지 바꾸므로 씨앗은 실제로 모델에 전달되어 쓰인다.
- 흐름상 한 녹음에 초상 호출은 한 번이라 바이트 차이가 사용자에게 보일 일은 없다. 같은 씨앗으로 다시 만들어도 같은 얼굴이 나오므로 "같은 녹음이면 같은 얼굴" 약속은 지켜진다.
- 할당량: 3회 ≈ 4,500뉴런(초상 1장 약 1,500뉴런)을 썼다. 리딩은 호출하지 않았다. 응답 이미지는 저장소에 넣지 않고 지웠다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `README.md` | "Workers AI 켜기" 3번: 해시 비교 → 눈·픽셀 비교, 실측 요약과 문서 경로, curl 예시를 파일 저장·JPEG 추출로. "알려진 한계"에 결정성의 범위 한 줄 |
| `worker/ai/workersAi.ts` | 모델 상수 주석: 결정성은 얼굴·구도까지이며 바이트는 다르다 |
| `branches/015-docs-portrait-seed-check/` | 설계·구현·리뷰 문서 |

## 설계 대비 달라진 점

없음. 호출 3회, 판정 3종을 설계대로 했다.

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 통과 |
| 린트 | `npm run lint` | 경고 0, 오류 0 |
| 단위 테스트 | `npm test` | 28 파일 181 테스트 통과(종료 코드 0) |
| 빌드 | `npm run build` | 통과 |

## 재현 스크립트 (픽셀 비교)

```python
# python3 -I pixdiff.py a.bmp b.bmp  — sips -s format bmp x.jpg --out x.bmp 로 만든 24/32비트 BMP
import struct, sys
def load(p):
    d = open(p, 'rb').read()
    off = struct.unpack('<I', d[10:14])[0]
    w, h = struct.unpack('<ii', d[18:26])
    bypp = struct.unpack('<H', d[28:30])[0] // 8
    row = (w * bypp + 3) & ~3
    px = bytearray()
    for y in range(abs(h)):
        line = d[off + y * row : off + y * row + w * bypp]
        for x in range(w): px += line[x * bypp : x * bypp + 3]
    return w, abs(h), px
(wa, ha, pa), (wb, hb, pb) = load(sys.argv[1]), load(sys.argv[2])
n = wa * ha; total = same = over8 = over32 = 0
for i in range(n):
    ds = [abs(pa[3*i+c] - pb[3*i+c]) for c in range(3)]
    total += sum(ds); d = max(ds)
    same += d == 0; over8 += d > 8; over32 += d > 32
print(f'mean={total/(3*n):.2f} same={same/n:.1%} >8={over8/n:.1%} >32={over32/n:.2%}')
```
