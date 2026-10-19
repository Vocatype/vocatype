import { describe, expect, it } from 'vitest'
import { hexToRgb, hexToRgba, luminance, signatureInkFor } from './contrast'

describe('contrast helpers', () => {
  it('3자리·6자리 hex를 읽고 잘못된 값은 null', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('#1E3A8A')).toEqual({ r: 30, g: 58, b: 138 })
    expect(hexToRgb('nope')).toBeNull()
    expect(hexToRgba('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
    expect(hexToRgba('zzz', 1)).toBe('rgba(128, 128, 128, 1)')
  })

  it('밝은 팔레트에는 어두운 선, 어두운 팔레트에는 흰 선', () => {
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5)
    expect(luminance('#000000')).toBe(0)
    expect(signatureInkFor('#F28C7A', '#F6C1A6')).toContain('30, 24, 40')
    expect(signatureInkFor('#1E3A8A', '#C2185B')).toContain('255, 255, 255')
  })
})
