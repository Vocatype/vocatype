import { describe, expect, it } from 'vitest'
import { extractFeatures } from './features'

/** 음절처럼 들리게 진폭을 syllableHz로 변조한 정현파. */
function syllabicTone(hz: number, seconds: number, sampleRate: number, syllableHz: number): Float32Array {
  const out = new Float32Array(Math.floor(seconds * sampleRate))
  for (let i = 0; i < out.length; i += 1) {
    const t = i / sampleRate
    const envelope = 0.55 + 0.45 * Math.sin(2 * Math.PI * syllableHz * t - Math.PI / 2)
    out[i] = 0.4 * envelope * Math.sin(2 * Math.PI * hz * t)
  }
  return out
}

describe('extractFeatures', () => {
  it('무음은 유성 프레임 0, NaN 없음', async () => {
    const features = await extractFeatures(new Float32Array(16000 * 2), 16000)
    expect(features.voicedFrameCount).toBe(0)
    expect(features.envelope).toEqual([])
    expect(features.f0Median).toBe(0)
    expect(features.speechRatio).toBe(0)
    for (const value of Object.values(features)) if (typeof value === 'number') expect(Number.isNaN(value)).toBe(false)
  })

  it('150Hz 음절 톤에서 피치와 음절 속도를 맞춘다', async () => {
    const features = await extractFeatures(syllabicTone(150, 4, 48000, 4), 48000)
    expect(features.sampleRate).toBe(16000)
    expect(Math.abs(features.f0Median - 150) / 150).toBeLessThan(0.03)
    expect(features.syllableRate).toBeGreaterThan(3)
    expect(features.syllableRate).toBeLessThan(5)
    expect(features.speechRatio).toBeGreaterThan(0.8)
    expect(features.envelope.length).toBeGreaterThan(50)
    expect(Math.max(...features.envelope)).toBe(1)
    expect(Math.min(...features.envelope)).toBeGreaterThanOrEqual(0)
  })

  it('앞뒤 무음은 말하기 구간에서 제외한다', async () => {
    const sampleRate = 16000
    const tone = syllabicTone(200, 2, sampleRate, 3)
    const padded = new Float32Array(sampleRate * 2 + tone.length + sampleRate * 2)
    padded.set(tone, sampleRate * 2)
    const features = await extractFeatures(padded, sampleRate)
    expect(features.speechRatio).toBeGreaterThan(0.7)
    expect(features.durationSec).toBeCloseTo(6, 1)
  })

  it('진행률 콜백이 0에서 1까지 단조 증가한다', async () => {
    const seen: number[] = []
    await extractFeatures(syllabicTone(120, 3, 16000, 4), 16000, (p) => seen.push(p))
    expect(seen[0]).toBeLessThanOrEqual(0.01)
    expect(seen[seen.length - 1]).toBe(1)
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1] ?? 0)
  })
})
