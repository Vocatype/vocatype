import { describe, expect, it } from 'vitest'
import { extractFeatures } from './features'

/** 음절처럼 들리게 진폭을 syllableHz로 변조한 정현파(순음). */
function syllabicTone(hz: number, seconds: number, sampleRate: number, syllableHz: number): Float32Array {
  const out = new Float32Array(Math.floor(seconds * sampleRate))
  for (let i = 0; i < out.length; i += 1) {
    const t = i / sampleRate
    const envelope = 0.55 + 0.45 * Math.sin(2 * Math.PI * syllableHz * t - Math.PI / 2)
    out[i] = 0.4 * envelope * Math.sin(2 * Math.PI * hz * t)
  }
  return out
}

interface SpeechLikeOptions {
  f0: number
  /** 조음 속도(쉼 제외 음절/초). */
  syllablesPerSecond: number
  syllables: number
  /** 이 수의 음절마다 쉼을 넣는다. */
  pauseEvery: number
  pauseMs: number
  sampleRate: number
}

/**
 * 말소리와 비슷한 합성 신호: 자음(60ms 잡음) + 모음(배음 있는 톤, 어택·디케이), 일정 음절마다 쉼.
 * 실제 녹음 대신 밀도·속도 축을 검증하는 데 쓴다.
 */
function speechLike({ f0, syllablesPerSecond, syllables, pauseEvery, pauseMs, sampleRate }: SpeechLikeOptions): {
  samples: Float32Array
  articulationSeconds: number
} {
  const syllableSamples = Math.round(sampleRate / syllablesPerSecond)
  const consonantSamples = Math.round(sampleRate * 0.06)
  const pauseSamples = Math.round((sampleRate * pauseMs) / 1000)
  const pauses = Math.floor((syllables - 1) / pauseEvery)
  const total = syllables * syllableSamples + pauses * pauseSamples + sampleRate
  const samples = new Float32Array(total)
  let seed = 7
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return (seed / 0x7fffffff) * 2 - 1
  }
  let position = Math.round(sampleRate * 0.5)
  for (let s = 0; s < syllables; s += 1) {
    for (let i = 0; i < consonantSamples; i += 1) samples[position + i] = 0.12 * noise()
    const vowelSamples = syllableSamples - consonantSamples
    for (let i = 0; i < vowelSamples; i += 1) {
      const t = i / sampleRate
      const ramp = Math.min(1, i / (sampleRate * 0.03), (vowelSamples - i) / (sampleRate * 0.05))
      samples[position + consonantSamples + i] =
        0.4 * ramp * (Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(2 * Math.PI * 2 * f0 * t) + 0.3 * Math.sin(2 * Math.PI * 3 * f0 * t))
    }
    position += syllableSamples
    if ((s + 1) % pauseEvery === 0 && s < syllables - 1) position += pauseSamples
  }
  return { samples, articulationSeconds: (syllables * syllableSamples) / sampleRate }
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
    expect(features.syllableRate).toBeGreaterThan(3.4)
    expect(features.syllableRate).toBeLessThan(4.6)
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

  it.each([
    { f0: 110, syllablesPerSecond: 4.5 },
    { f0: 210, syllablesPerSecond: 4.5 },
    { f0: 110, syllablesPerSecond: 6 },
    { f0: 210, syllablesPerSecond: 6 },
  ])('말소리형 신호 $f0Hz·$syllablesPerSecond음절/초: 자음·쉼을 포함해도 피치·속도·밀도가 맞는다', async ({ f0, syllablesPerSecond }) => {
    const { samples, articulationSeconds } = speechLike({ f0, syllablesPerSecond, syllables: 32, pauseEvery: 8, pauseMs: 400, sampleRate: 16000 })
    const features = await extractFeatures(samples, 16000)
    expect(Math.abs(features.f0Median - f0) / f0).toBeLessThan(0.03)
    // 조음 속도: 실제 값의 ±15%
    expect(Math.abs(features.syllableRate - syllablesPerSecond) / syllablesPerSecond).toBeLessThan(0.15)
    // 밀도: 쉼 3회(1.2초) 대비 조음 시간 비율과 일치
    const expectedRatio = articulationSeconds / (articulationSeconds + 1.2)
    expect(Math.abs(features.speechRatio - expectedRatio)).toBeLessThan(0.08)
    expect(features.pauseCount).toBe(3)
  })

  it('진행률 콜백이 0에서 1까지 단조 증가하고 취소하면 거부된다', async () => {
    const seen: number[] = []
    await extractFeatures(syllabicTone(120, 3, 16000, 4), 16000, { onProgress: (p) => seen.push(p) })
    expect(seen[0]).toBeLessThanOrEqual(0.01)
    expect(seen[seen.length - 1]).toBe(1)
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1] ?? 0)

    const controller = new AbortController()
    const promise = extractFeatures(syllabicTone(120, 10, 16000, 4), 16000, { signal: controller.signal })
    controller.abort()
    await expect(promise).rejects.toThrow()
  })
})
