/** 여러 채널을 평균해 모노로 만든다. */
export function downmixToMono(channels: readonly Float32Array[]): Float32Array {
  const first = channels[0]
  if (!first) return new Float32Array(0)
  if (channels.length === 1) return first
  const out = new Float32Array(first.length)
  for (const channel of channels) {
    for (let i = 0; i < out.length; i += 1) out[i] = (out[i] ?? 0) + (channel[i] ?? 0)
  }
  for (let i = 0; i < out.length; i += 1) out[i] = (out[i] ?? 0) / channels.length
  return out
}

/**
 * 간단한 다운샘플링. 비율만큼의 샘플을 평균(상자 필터)해 앨리어싱을 줄인다.
 * 피치·에너지 추정에는 충분하고, 고음질 재생용은 아니다.
 */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)
  const box = Math.max(1, Math.round(ratio))
  for (let i = 0; i < outLength; i += 1) {
    const start = Math.floor(i * ratio)
    let sum = 0
    let count = 0
    for (let k = 0; k < box && start + k < input.length; k += 1) {
      sum += input[start + k] ?? 0
      count += 1
    }
    out[i] = count > 0 ? sum / count : 0
  }
  return out
}

export function rms(frame: Float32Array, start = 0, length = frame.length - start): number {
  if (length <= 0) return 0
  let sum = 0
  for (let i = start; i < start + length; i += 1) {
    const value = frame[i] ?? 0
    sum += value * value
  }
  return Math.sqrt(sum / length)
}

/** 부호 변화 횟수 / 길이. 밝은(고주파 성분이 많은) 소리일수록 크다. */
export function zeroCrossingRate(frame: Float32Array, start = 0, length = frame.length - start): number {
  if (length <= 1) return 0
  let crossings = 0
  for (let i = start + 1; i < start + length; i += 1) {
    const prev = frame[i - 1] ?? 0
    const cur = frame[i] ?? 0
    if ((prev >= 0 && cur < 0) || (prev < 0 && cur >= 0)) crossings += 1
  }
  return crossings / length
}

export interface PitchEstimate {
  /** 기본 주파수(Hz). */
  f0: number
  /** 0..1. 1에 가까울수록 주기성이 뚜렷하다. */
  confidence: number
}

/**
 * YIN 알고리즘(차분 함수 + 누적 평균 정규화 + 포물선 보간)으로 한 프레임의 피치를 추정한다.
 * buffer는 window + 최대 지연(tauMax) 이상이어야 한다.
 */
export function yinPitch(
  buffer: Float32Array,
  start: number,
  window: number,
  sampleRate: number,
  minHz: number,
  maxHz: number,
  threshold = 0.15,
): PitchEstimate | null {
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz))
  const tauMax = Math.ceil(sampleRate / minHz)
  if (start + window + tauMax > buffer.length) return null

  const diff = new Float32Array(tauMax + 1)
  for (let tau = 1; tau <= tauMax; tau += 1) {
    let sum = 0
    for (let j = 0; j < window; j += 1) {
      const delta = (buffer[start + j] ?? 0) - (buffer[start + j + tau] ?? 0)
      sum += delta * delta
    }
    diff[tau] = sum
  }

  // 누적 평균 정규화 차분 함수
  const cmnd = new Float32Array(tauMax + 1)
  cmnd[0] = 1
  let running = 0
  for (let tau = 1; tau <= tauMax; tau += 1) {
    running += diff[tau] ?? 0
    cmnd[tau] = running > 0 ? ((diff[tau] ?? 0) * tau) / running : 1
  }

  // 임계값 아래로 처음 내려가는 지연을 찾고, 그 근처의 국소 최소로 이동
  let tau = -1
  for (let t = tauMin; t <= tauMax; t += 1) {
    if ((cmnd[t] ?? 1) < threshold) {
      while (t + 1 <= tauMax && (cmnd[t + 1] ?? 1) < (cmnd[t] ?? 1)) t += 1
      tau = t
      break
    }
  }
  if (tau < 0) {
    let best = tauMin
    for (let t = tauMin + 1; t <= tauMax; t += 1) {
      if ((cmnd[t] ?? 1) < (cmnd[best] ?? 1)) best = t
    }
    tau = best
  }

  // 포물선 보간으로 정수 지연 사이의 값을 추정
  let refined = tau
  if (tau > 1 && tau < tauMax) {
    const s0 = cmnd[tau - 1] ?? 1
    const s1 = cmnd[tau] ?? 1
    const s2 = cmnd[tau + 1] ?? 1
    const denominator = 2 * (2 * s1 - s2 - s0)
    if (denominator !== 0) refined = tau + (s2 - s0) / denominator
  }

  const value = cmnd[tau] ?? 1
  return { f0: sampleRate / refined, confidence: Math.max(0, Math.min(1, 1 - value)) }
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0)
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))
  return sorted[index] ?? 0
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  let sum = 0
  for (const value of values) sum += (value - avg) ** 2
  return Math.sqrt(sum / (values.length - 1))
}
