import { describe, expect, it } from 'vitest'
import { resampleEnvelope, signatureBars } from './signature'

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
