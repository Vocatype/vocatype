import { describe, expect, it } from 'vitest'
import { axesToTypeCode, type VoiceAxes } from '../analysis/axes'
import { axisStrengths } from './axisStrength'

const axes: VoiceAxes = { warmth: 0.82, density: 0.31, pace: 0.5, variation: 0.47, pitch: 0.3, brightness: 0.2 }

describe('axisStrengths', () => {
  it('결정된 쪽과 기운 비율을 준다', () => {
    const [temperature, texture, pace, flow] = axisStrengths(axes)
    expect(temperature).toMatchObject({ key: 'temperature', letter: 'W', otherLetter: 'C', percent: 82, boundary: false })
    expect(texture).toMatchObject({ key: 'texture', letter: 'L', otherLetter: 'F', percent: 69, boundary: false })
    expect(pace).toMatchObject({ key: 'pace', letter: 'Q', percent: 50, boundary: true })
    expect(flow).toMatchObject({ key: 'flow', letter: 'E', percent: 53, boundary: true })
  })

  it('경계 판정은 표시값 기준이라 좌우 대칭이다', () => {
    const at = (warmth: number) => axisStrengths({ ...axes, warmth })[0]!
    expect(at(0.45)).toMatchObject({ letter: 'C', percent: 55, boundary: false })
    expect(at(0.55)).toMatchObject({ letter: 'W', percent: 55, boundary: false })
    expect(at(0.549)).toMatchObject({ letter: 'W', percent: 55, boundary: false })
    expect(at(0.544)).toMatchObject({ letter: 'W', percent: 54, boundary: true })
    expect(at(0.451)).toMatchObject({ letter: 'C', percent: 55, boundary: false })
    expect(at(0)).toMatchObject({ letter: 'C', percent: 100, boundary: false })
    expect(at(1)).toMatchObject({ letter: 'W', percent: 100, boundary: false })
  })

  it('글자 순서와 결정은 타입 코드와 항상 같다', () => {
    for (let w = 0; w <= 1; w += 0.05) {
      for (let d = 0; d <= 1; d += 0.25) {
        for (let p = 0; p <= 1; p += 0.25) {
          for (let v = 0; v <= 1; v += 0.25) {
            const a: VoiceAxes = { warmth: w, density: d, pace: p, variation: v, pitch: 0.5, brightness: 0.5 }
            expect(axisStrengths(a).map((axis) => axis.letter).join('')).toBe(axesToTypeCode(a))
          }
        }
      }
    }
  })

  it('퍼센트는 50~100 안에 있다', () => {
    for (const value of [0, 0.25, 0.5, 0.75, 1]) {
      for (const axis of axisStrengths({ ...axes, warmth: value })) {
        expect(axis.percent).toBeGreaterThanOrEqual(50)
        expect(axis.percent).toBeLessThanOrEqual(100)
      }
    }
  })
})
