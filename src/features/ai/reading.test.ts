import { describe, expect, it } from 'vitest'
import { planGeneration, visibleReading } from './reading'

describe('planGeneration', () => {
  it('켜진 기능만 요청하고 첫 단계는 초상 > 리딩 > 없음 순', () => {
    expect(planGeneration({ portrait: true, reading: true }, 'ok')).toEqual({ wantPortrait: true, wantReading: true, stage: 'portrait' })
    expect(planGeneration({ portrait: false, reading: true }, 'ok')).toEqual({ wantPortrait: false, wantReading: true, stage: 'reading' })
    expect(planGeneration({ portrait: true, reading: false }, 'ok')).toEqual({ wantPortrait: true, wantReading: false, stage: 'portrait' })
    expect(planGeneration({ portrait: false, reading: false }, 'ok')).toEqual({ wantPortrait: false, wantReading: false, stage: null })
  })

  it('목소리가 거의 잡히지 않은 녹음은 리딩을 요청하지 않는다(초상은 그대로)', () => {
    expect(planGeneration({ portrait: true, reading: true }, 'low-signal')).toEqual({ wantPortrait: true, wantReading: false, stage: 'portrait' })
    expect(planGeneration({ portrait: false, reading: true }, 'low-signal')).toEqual({ wantPortrait: false, wantReading: false, stage: null })
  })
})

describe('visibleReading', () => {
  const reading = { locale: 'ko' as const, reading: '문단', caption: '캡션' }

  it('생성 시점 언어와 같을 때만 보여 준다', () => {
    expect(visibleReading(reading, 'ko')).toBe(reading)
    expect(visibleReading(reading, 'en')).toBeNull()
    expect(visibleReading(null, 'ko')).toBeNull()
  })
})
