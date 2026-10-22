import { describe, expect, it } from 'vitest'
import { mixHex } from './contrast'
import { resampleEnvelope, signatureBars, signatureColors } from './signature'

describe('resampleEnvelope', () => {
  it('길이를 맞추고 최대값을 1로 정규화한다', () => {
    const out = resampleEnvelope([0.1, 0.2, 0.4, 0.2, 0.1, 0.05], 3)
    expect(out).toHaveLength(3)
    expect(Math.max(...out)).toBe(1)
  })

  it('입력보다 많은 빈을 요청해도 동작한다', () => {
    const out = resampleEnvelope([0.5, 1], 6)
    expect(out).toHaveLength(6)
    expect(out.every((v) => v >= 0 && v <= 1)).toBe(true)
  })

  it('빈 입력은 0으로 채운다', () => {
    expect(resampleEnvelope([], 4)).toEqual([0, 0, 0, 0])
  })
  it('튀는 한 순간이 나머지를 누르지 않는다(95번째 백분위수를 1로, 그 위는 1로 자르고 제곱근)', () => {
    const values = Array.from({ length: 100 }, (_, i) => (i + 1) / 100)
    values[50] = 10 // 기침·파열음 같은 한 번의 큰 소리
    const out = resampleEnvelope(values, 100)
    expect(out[50]).toBe(1)
    expect(Math.max(...out)).toBe(1)
    // 최댓값 정규화였다면 0.25/10 = 0.025로 눌렸을 값이 고리에서 보일 만큼 남는다.
    expect(out[24]).toBeGreaterThan(0.4)
    expect(out.every((v) => v >= 0 && v <= 1)).toBe(true)
  })
})

describe('signatureColors', () => {
  const palette = ['#9A8CD6', '#C9B6E4', '#A7C7E7', '#F4C2C2', '#EEEFF5']

  it('막대 수만큼, 첫 색은 팔레트 첫 색을 바탕에 맞게 밝히거나(어두운 바탕) 어둡게(밝은 바탕) 한 값', () => {
    const dark = signatureColors(palette, 180, 'dark')
    const light = signatureColors(palette, 180, 'light')
    expect(dark).toHaveLength(180)
    expect(light).toHaveLength(180)
    expect(dark[0]).toBe(mixHex('#9A8CD6', '#ffffff', 0.18))
    expect(light[0]).toBe(mixHex('#9A8CD6', '#000000', 0.25))
  })

  it('앞 4색을 시간 순서로 지나고 다섯째(가장 밝은 색)는 쓰지 않는다', () => {
    const dark = signatureColors(palette, 180, 'dark')
    expect(dark[45]).toBe(mixHex('#C9B6E4', '#ffffff', 0.18))
    expect(dark[90]).toBe(mixHex('#A7C7E7', '#ffffff', 0.18))
    expect(dark[135]).toBe(mixHex('#F4C2C2', '#ffffff', 0.18))
    expect(dark).not.toContain(mixHex('#EEEFF5', '#ffffff', 0.18))
  })

  it('팔레트가 비거나 막대가 없으면 빈 배열', () => {
    expect(signatureColors([], 10, 'dark')).toEqual([])
    expect(signatureColors(palette, 0, 'light')).toEqual([])
  })
})

describe('signatureBars', () => {
  it('첫 막대는 12시 방향, 개수는 입력과 같다', () => {
    const bars = signatureBars([1, 0.5, 0], 100, 100, 40, 90)
    expect(bars).toHaveLength(3)
    expect(bars[0]?.x1).toBeCloseTo(100, 5)
    expect(bars[0]?.y1).toBeCloseTo(60, 5)
    expect(bars[0]?.y2).toBeCloseTo(10, 5)
  })

  it('값 0도 최소 길이를 가진다', () => {
    const [bar] = signatureBars([0], 0, 0, 40, 90)
    const length = Math.hypot((bar?.x2 ?? 0) - (bar?.x1 ?? 0), (bar?.y2 ?? 0) - (bar?.y1 ?? 0))
    expect(length).toBeCloseTo(4, 5)
  })
})
