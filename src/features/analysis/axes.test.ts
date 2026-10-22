import { describe, expect, it } from 'vitest'
import { ALL_TYPE_CODES } from '../../../shared/typeCode'
import { DEFAULT_LOCALE } from '../../i18n/locales'
import { axesToTypeCode, featuresToAxes, mapLog, mapRange, seedFromFeatures } from './axes'
import type { VoiceFeatures } from './features'

const base: VoiceFeatures = {
  durationSec: 12,
  sampleRate: 16000,
  frameCount: 370,
  energeticFrameCount: 300,
  voicedFrameCount: 250,
  speechRatio: 0.8,
  f0Median: 150,
  f0Variation: 0.2,
  f0Low: 120,
  f0High: 190,
  rmsMean: 0.08,
  rmsVariation: 0.5,
  zcrMean: 0.07,
  tiltMedian: 0.18,
  syllableRate: 4.2,
  pauseCount: 3,
  envelope: [],
}

describe('mapRange / mapLog', () => {
  it('구간 밖은 잘라 내고 안은 선형', () => {
    expect(mapRange(0, 1, 3)).toBe(0)
    expect(mapRange(2, 1, 3)).toBe(0.5)
    expect(mapRange(9, 1, 3)).toBe(1)
    expect(mapRange(5, 2, 2)).toBe(0.5)
  })

  it('로그 사상은 기하 평균에서 0.5', () => {
    expect(mapLog(Math.sqrt(85 * 255), 85, 255)).toBeCloseTo(0.5, 5)
    expect(mapLog(0, 85, 255)).toBe(0.5)
  })
})

describe('featuresToAxes / axesToTypeCode', () => {
  it('낮고 어두운 목소리는 따뜻함(W)', () => {
    const axes = featuresToAxes({ ...base, f0Median: 100, tiltMedian: 0.07 })
    expect(axes.warmth).toBeGreaterThan(0.7)
    expect(axesToTypeCode(axes).startsWith('W')).toBe(true)
  })

  it('높고 밝은 목소리는 서늘함(C)', () => {
    const axes = featuresToAxes({ ...base, f0Median: 230, tiltMedian: 0.3 })
    expect(axes.warmth).toBeLessThan(0.3)
    expect(axesToTypeCode(axes).startsWith('C')).toBe(true)
  })

  it('속도·밀도·변화 축이 글자에 반영된다', () => {
    const quickFullVivid = featuresToAxes({ ...base, syllableRate: 5.2, speechRatio: 0.92, f0Variation: 0.3, rmsVariation: 0.8 })
    expect(axesToTypeCode(quickFullVivid).slice(1)).toBe('FQV')
    const slowLightEven = featuresToAxes({ ...base, syllableRate: 2.6, speechRatio: 0.62, f0Variation: 0.08, rmsVariation: 0.2 })
    expect(axesToTypeCode(slowLightEven).slice(1)).toBe('LME')
  })

  it('조음 속도 범위는 언어마다 다르다', () => {
    const rate = { ...base, syllableRate: 5 }
    expect(featuresToAxes(rate, { locale: 'en' }).pace).toBeGreaterThan(0.5)
    expect(featuresToAxes(rate, { locale: 'ko' }).pace).toBeLessThan(0.5)
  })

  it('언어를 주지 않으면 앱 기본 언어(DEFAULT_LOCALE)의 조음 속도 범위를 쓴다', () => {
    const rate = { ...base, syllableRate: 5 }
    expect(featuresToAxes(rate).pace).toBe(featuresToAxes(rate, { locale: DEFAULT_LOCALE }).pace)
  })

  it('신호가 거의 없으면 모든 축이 0.5', () => {
    const axes = featuresToAxes({ ...base, voicedFrameCount: 3, f0Median: 0 })
    for (const value of Object.values(axes)) expect(value).toBe(0.5)
  })

  it('가능한 모든 코드는 16개 안에 있다', () => {
    expect(ALL_TYPE_CODES).toHaveLength(16)
    expect(ALL_TYPE_CODES).toContain(axesToTypeCode(featuresToAxes(base)))
  })
})

describe('seedFromFeatures', () => {
  it('같은 특징이면 같은 씨앗, 조금 달라도 다른 씨앗', () => {
    expect(seedFromFeatures(base)).toBe(seedFromFeatures({ ...base }))
    expect(seedFromFeatures(base)).not.toBe(seedFromFeatures({ ...base, f0Median: 151 }))
    expect(seedFromFeatures(base)).toBeGreaterThanOrEqual(0)
  })
})
