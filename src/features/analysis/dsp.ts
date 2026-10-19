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
 * 디코딩 단계에서 브라우저가 이미 목표 샘플레이트로 맞춰 주는 것이 보통이라, 이 함수는 폴백이다.
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

/**
 * 1차 하이패스 필터. DC 오프셋과 저역 럼블을 걷어내 RMS·영교차율이 기기별로 흔들리지 않게 한다.
 * alpha 0.98, 16kHz 기준 차단 주파수 약 50Hz.
 */
export function highPass(input: Float32Array, alpha = 0.98): Float32Array {
  const out = new Float32Array(input.length)
  let prevIn = 0
  let prevOut = 0
  for (let i = 0; i < input.length; i += 1) {
    const x = input[i] ?? 0
    const y = x - prevIn + alpha * prevOut
    out[i] = y
    prevIn = x
    prevOut = y
  }
  return out
}

/**
 * 1차 로우패스 필터. 음절 포락선을 만들 때 치찰음·파열음(고주파 잡음)이 모음 봉우리와 겹쳐 세어지지 않게
 * 모음 대역(~1kHz 이하)만 남긴다. alpha 0.325, 16kHz 기준 차단 주파수 약 1kHz.
 */
export function lowPass(input: Float32Array, alpha = 0.325): Float32Array {
  const out = new Float32Array(input.length)
  let prev = 0
  for (let i = 0; i < input.length; i += 1) {
    prev += alpha * ((input[i] ?? 0) - prev)
    out[i] = prev
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

/**
 * 스펙트럼 기울기 지표: 1차 차분 신호의 RMS / 원신호 RMS.
 * 고주파 에너지가 많을수록 크다. 진폭으로 가중되므로 영교차율보다 작은 잡음에 덜 흔들린다.
 * 순음에서는 2π·f/fs 에 비례한다.
 */
export function spectralTilt(frame: Float32Array, start = 0, length = frame.length - start): number {
  if (length <= 1) return 0
  let sumDiff = 0
  let sum = 0
  for (let i = start + 1; i < start + length; i += 1) {
    const cur = frame[i] ?? 0
    const prev = frame[i - 1] ?? 0
    sumDiff += (cur - prev) * (cur - prev)
    sum += cur * cur
  }
  return sum > 0 ? Math.sqrt(sumDiff / sum) : 0
}

export interface PitchEstimate {
  /** 기본 주파수(Hz). */
  f0: number
  /** 0..1. 1에 가까울수록 주기성이 뚜렷하다. */
  confidence: number
}

/** 선택한 지연이 이 값보다 깊으면(작으면) 옥타브 검사를 생략한다. 순음처럼 이미 확실한 경우. */
const OCTAVE_CHECK_FLOOR = 0.03

/**
 * YIN 알고리즘(차분 함수 + 누적 평균 정규화 + 포물선 보간)으로 한 프레임의 피치를 추정한다.
 * - 임계값 아래 첫 번째 dip의 국소 최소를 고른 뒤, 그 두 배 지연 근처에 뚜렷이 더 깊은 최소가 있으면
 *   그쪽을 택한다(기본음이 약하고 짝수 배음이 강할 때 생기는 옥타브 오류 방지).
 * - dip을 찾으면 2τ+2까지만 계산해 연산량을 줄인다.
 * buffer는 start + window + 최대 지연(tauMax) 이상이어야 한다.
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

  const cmnd = new Float32Array(tauMax + 1)
  cmnd[0] = 1
  let running = 0
  let found = -1
  let inDip = false
  let best = tauMin
  let limit = tauMax
  let computed = 0

  for (let tau = 1; tau <= limit; tau += 1) {
    let sum = 0
    for (let j = 0; j < window; j += 1) {
      const delta = (buffer[start + j] ?? 0) - (buffer[start + j + tau] ?? 0)
      sum += delta * delta
    }
    running += sum
    const value = running > 0 ? (sum * tau) / running : 1
    cmnd[tau] = value
    computed = tau
    if (tau < tauMin || found >= 0) continue

    if (value < (cmnd[best] ?? 1)) best = tau
    if (!inDip && value < threshold) inDip = true
    if (inDip && tau > tauMin && value > (cmnd[tau - 1] ?? 1)) {
      found = tau - 1
      limit = Math.min(tauMax, 2 * found + 2)
    }
  }
  if (found < 0) found = inDip ? computed : best

  // 옥타브 검사: 2τ 근처(±2)에 뚜렷이 더 깊은 최소가 있으면 그쪽이 진짜 주기다.
  if ((cmnd[found] ?? 1) > OCTAVE_CHECK_FLOOR) {
    let alt = -1
    for (let t = 2 * found - 2; t <= 2 * found + 2; t += 1) {
      if (t < tauMin || t > computed) continue
      if (alt < 0 || (cmnd[t] ?? 1) < (cmnd[alt] ?? 1)) alt = t
    }
    if (alt > 0 && (cmnd[alt] ?? 1) < 0.5 * (cmnd[found] ?? 1)) found = alt
  }

  // 포물선 보간으로 정수 지연 사이의 값을 추정
  let refined = found
  if (found > 1 && found + 1 <= computed) {
    const s0 = cmnd[found - 1] ?? 1
    const s1 = cmnd[found] ?? 1
    const s2 = cmnd[found + 1] ?? 1
    const denominator = 2 * (2 * s1 - s2 - s0)
    if (denominator !== 0) refined = found + Math.max(-1, Math.min(1, (s2 - s0) / denominator))
  }

  const value = cmnd[found] ?? 1
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
