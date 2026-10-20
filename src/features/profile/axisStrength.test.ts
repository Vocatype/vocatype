import { describe, expect, it } from 'vitest'
import { axisStrengths } from './axisStrength'

const axes = { warmth: 0.82, density: 0.31, pace: 0.5, variation: 0.47, pitch: 0.3, brightness: 0.2 }

describe('axisStrengths', () => {
  it('결정된 쪽과 기운 비율을 준다', () => {
    const [temperature, texture, pace, flow] = axisStrengths(axes)
    expect(temperature).toMatchObject({ key: 'temperature', letter: 'W', otherLetter: 'C', percent: 82, boundary: false })
    expect(texture).toMatchObject({ key: 'texture', letter: 'L', otherLetter: 'F', percent: 69, boundary: false })
    expect(pace).toMatchObject({ key: 'pace', letter: 'Q', percent: 50, boundary: true })
    expect(flow).toMatchObject({ key: 'flow', letter: 'E', percent: 53, boundary: true })
  })

  it('순서는 타입 코드 글자 순서와 같다', () => {
    const letters = axisStrengths(axes).map((axis) => axis.letter).join('')
    expect(letters).toBe('WLQE')
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
