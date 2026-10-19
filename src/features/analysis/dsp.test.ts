import { describe, expect, it } from 'vitest'
import { highPass, lowPass, median, percentile, resample, rms, spectralTilt, yinPitch, zeroCrossingRate } from './dsp'

function sine(hz: number, seconds: number, sampleRate: number, amplitude = 0.5): Float32Array {
  const out = new Float32Array(Math.floor(seconds * sampleRate))
  for (let i = 0; i < out.length; i += 1) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / sampleRate)
  return out
}

describe('yinPitch', () => {
  it('정현파의 기본 주파수를 2% 안에서 맞춘다', () => {
    for (const hz of [110, 180, 240]) {
      const signal = sine(hz, 0.2, 16000)
      const estimate = yinPitch(signal, 0, 1024, 16000, 60, 500)
      expect(estimate, `${hz}`).not.toBeNull()
      expect(Math.abs((estimate?.f0 ?? 0) - hz) / hz, `${hz}`).toBeLessThan(0.02)
      expect(estimate?.confidence ?? 0).toBeGreaterThan(0.9)
    }
  })

  it('배음이 섞인 신호에서도 기본음을 고른다', () => {
    const sampleRate = 16000
    const out = new Float32Array(3200)
    for (let i = 0; i < out.length; i += 1) {
      const t = i / sampleRate
      out[i] = 0.5 * Math.sin(2 * Math.PI * 130 * t) + 0.3 * Math.sin(2 * Math.PI * 260 * t) + 0.2 * Math.sin(2 * Math.PI * 390 * t)
    }
    const estimate = yinPitch(out, 0, 1024, sampleRate, 60, 500)
    expect(Math.abs((estimate?.f0 ?? 0) - 130) / 130).toBeLessThan(0.02)
  })

  it('버퍼가 짧으면 null', () => {
    expect(yinPitch(new Float32Array(500), 0, 1024, 16000, 60, 500)).toBeNull()
  })

  it('무작위 잡음은 신뢰도가 낮다', () => {
    const noise = new Float32Array(3200)
    let seed = 1
    for (let i = 0; i < noise.length; i += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      noise[i] = (seed / 0x7fffffff) * 2 - 1
    }
    const estimate = yinPitch(noise, 0, 1024, 16000, 60, 500)
    expect(estimate?.confidence ?? 0).toBeLessThan(0.6)
  })
})

describe('resample', () => {
  it('길이를 비율대로 줄이고 주파수를 유지한다', () => {
    const signal = sine(200, 0.5, 48000)
    const down = resample(signal, 48000, 16000)
    expect(down.length).toBe(8000)
    const estimate = yinPitch(down, 0, 1024, 16000, 60, 500)
    expect(Math.abs((estimate?.f0 ?? 0) - 200) / 200).toBeLessThan(0.02)
  })

  it('같은 샘플레이트면 그대로 돌려준다', () => {
    const signal = sine(200, 0.1, 16000)
    expect(resample(signal, 16000, 16000)).toBe(signal)
  })
})

describe('rms / zcr', () => {
  it('정현파 RMS는 진폭/√2', () => {
    expect(rms(sine(100, 0.5, 16000, 0.5))).toBeCloseTo(0.5 / Math.SQRT2, 2)
    expect(rms(new Float32Array(100))).toBe(0)
  })

  it('영교차율은 주파수에 비례한다', () => {
    const low = zeroCrossingRate(sine(100, 1, 16000))
    const high = zeroCrossingRate(sine(400, 1, 16000))
    expect(low).toBeCloseTo(200 / 16000, 3)
    expect(high).toBeCloseTo(800 / 16000, 3)
  })
})

describe('lowPass', () => {
  it('1kHz 위 성분을 크게 줄이고 저음은 유지한다', () => {
    const low = rms(lowPass(sine(150, 0.5, 16000)).slice(2000))
    const high = rms(lowPass(sine(4000, 0.5, 16000)).slice(2000))
    expect(low).toBeGreaterThan(0.3)
    expect(high).toBeLessThan(0.1)
  })
})

describe('spectralTilt', () => {
  it('순음에서 주파수에 비례하고 배음이 더해지면 커진다', () => {
    const low = spectralTilt(sine(200, 0.5, 16000))
    const high = spectralTilt(sine(400, 0.5, 16000))
    expect(high / low).toBeCloseTo(2, 1)
    expect(low).toBeCloseTo((2 * Math.PI * 200) / 16000, 2)
    const rich = sine(200, 0.5, 16000).map((v, i) => v + 0.5 * Math.sin((2 * Math.PI * 1600 * i) / 16000))
    expect(spectralTilt(rich)).toBeGreaterThan(low * 2)
  })
})

describe('median / percentile', () => {
  it('짝수·홀수 길이를 처리한다', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBe(0)
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(percentile([1, 2, 3, 4, 5], 1)).toBe(5)
  })
})

describe('yinPitch 옥타브 검사', () => {
  it('기본음이 약하고 짝수 배음이 강해도 기본음을 고른다', () => {
    const sampleRate = 16000
    const out = new Float32Array(3200)
    for (let i = 0; i < out.length; i += 1) {
      const t = i / sampleRate
      out[i] =
        0.1 * Math.sin(2 * Math.PI * 95 * t) +
        0.6 * Math.sin(2 * Math.PI * 190 * t) +
        0.1 * Math.sin(2 * Math.PI * 285 * t) +
        0.3 * Math.sin(2 * Math.PI * 380 * t)
    }
    const estimate = yinPitch(out, 0, 1024, sampleRate, 60, 500)
    expect(Math.abs((estimate?.f0 ?? 0) - 95) / 95).toBeLessThan(0.02)
  })

  it('순음은 옥타브 아래로 떨어지지 않는다', () => {
    const estimate = yinPitch(sine(190, 0.2, 16000), 0, 1024, 16000, 60, 500)
    expect(Math.abs((estimate?.f0 ?? 0) - 190) / 190).toBeLessThan(0.02)
  })
})

describe('highPass', () => {
  it('DC 오프셋을 제거하고 교류 성분은 남긴다', () => {
    const signal = sine(200, 0.5, 16000)
    const offset = signal.map((v) => v + 0.3)
    const filtered = highPass(offset)
    const tail = filtered.slice(4000)
    let sum = 0
    for (const v of tail) sum += v
    expect(Math.abs(sum / tail.length)).toBeLessThan(0.01)
    expect(rms(tail)).toBeGreaterThan(0.3)
  })
})

describe('resample 비정수 비율', () => {
  it('44.1kHz → 16kHz에서도 피치가 유지된다', () => {
    const down = resample(sine(180, 0.5, 44100), 44100, 16000)
    const estimate = yinPitch(down, 0, 1024, 16000, 60, 500)
    expect(Math.abs((estimate?.f0 ?? 0) - 180) / 180).toBeLessThan(0.02)
  })
})
