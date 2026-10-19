import { mean, median, percentile, resample, rms, standardDeviation, yinPitch, zeroCrossingRate } from './dsp'

/** 녹음 한 건에서 뽑은 원시 특징. 숫자는 모두 사람이 읽을 수 있는 단위다. */
export interface VoiceFeatures {
  durationSec: number
  /** 분석에 쓴 샘플레이트(Hz). */
  sampleRate: number
  frameCount: number
  voicedFrameCount: number
  /** 말하기 시작~끝 구간 중 유성(목소리가 있는) 프레임 비율 0..1. */
  speechRatio: number
  /** 유성 프레임 피치 중앙값(Hz). 유성 프레임이 없으면 0. */
  f0Median: number
  /** 피치 사분위 범위 / 중앙값. 억양 변화의 크기. */
  f0Variation: number
  f0Low: number
  f0High: number
  /** 유성 프레임 RMS 평균. */
  rmsMean: number
  /** 유성 프레임 RMS 표준편차 / 평균. 강약 변화의 크기. */
  rmsVariation: number
  /** 유성 프레임 영교차율 평균. 음색 밝기. */
  zcrMean: number
  /** 초당 음절(에너지 봉우리) 수. 말하기 속도. */
  syllableRate: number
  /** 말하는 구간 안의 쉼(200ms 이상 무성) 횟수. */
  pauseCount: number
  /** 말하는 구간의 프레임별 에너지(최대값 기준 0..1). 사운드 시그니처 그림에 쓴다. */
  envelope: number[]
}

export const ANALYSIS_SAMPLE_RATE = 16000
const WINDOW = 1024
const HOP = 512
const MIN_HZ = 60
const MAX_HZ = 500
const PITCH_CONFIDENCE = 0.6
const YIELD_EVERY_FRAMES = 48

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

interface FrameInfo {
  rms: number
  zcr: number
  f0: number | null
}

/**
 * PCM 샘플에서 특징을 뽑는다. 긴 루프는 주기적으로 이벤트 루프에 양보해 화면이 멈추지 않게 한다.
 * @param onProgress 0..1 진행률
 */
export async function extractFeatures(
  input: Float32Array,
  inputRate: number,
  onProgress?: (progress: number) => void,
): Promise<VoiceFeatures> {
  const sampleRate = ANALYSIS_SAMPLE_RATE
  const samples = resample(input, inputRate, sampleRate)
  const durationSec = samples.length / sampleRate
  const tauMax = Math.ceil(sampleRate / MIN_HZ)
  const frameCount = Math.max(0, Math.floor((samples.length - WINDOW - tauMax) / HOP) + 1)

  const frames: FrameInfo[] = []
  for (let i = 0; i < frameCount; i += 1) {
    const start = i * HOP
    frames.push({ rms: rms(samples, start, WINDOW), zcr: zeroCrossingRate(samples, start, WINDOW), f0: null })
    if (i % YIELD_EVERY_FRAMES === 0) {
      onProgress?.((i / Math.max(1, frameCount)) * 0.3)
      await yieldToEventLoop()
    }
  }

  // 유성 판정: 녹음 안의 상위 에너지 대비 상대 임계값 (마이크 게인 차이를 흡수)
  const loud = percentile(
    frames.map((frame) => frame.rms),
    0.9,
  )
  const silenceLevel = Math.max(0.004, loud * 0.12)
  const energetic = frames.map((frame) => frame.rms > silenceLevel)

  // 피치는 에너지가 있는 프레임에서만 계산
  for (let i = 0; i < frameCount; i += 1) {
    if (!energetic[i]) continue
    const estimate = yinPitch(samples, i * HOP, WINDOW, sampleRate, MIN_HZ, MAX_HZ)
    const frame = frames[i]
    if (frame && estimate && estimate.confidence >= PITCH_CONFIDENCE) frame.f0 = estimate.f0
    if (i % YIELD_EVERY_FRAMES === 0) {
      onProgress?.(0.3 + (i / Math.max(1, frameCount)) * 0.65)
      await yieldToEventLoop()
    }
  }

  const voiced = frames.map((frame, i) => (energetic[i] ?? false) && frame.f0 !== null)
  const voicedFrames = frames.filter((_, i) => voiced[i])
  const firstVoiced = voiced.indexOf(true)
  const lastVoiced = voiced.lastIndexOf(true)
  const span = firstVoiced >= 0 ? lastVoiced - firstVoiced + 1 : 0

  const f0s = voicedFrames.map((frame) => frame.f0 ?? 0)
  const f0Median = median(f0s)
  const f0Iqr = f0s.length > 0 ? percentile(f0s, 0.75) - percentile(f0s, 0.25) : 0
  const rmsValues = voicedFrames.map((frame) => frame.rms)
  const rmsMean = mean(rmsValues)

  // 음절 속도: 말하는 구간의 에너지 봉우리 개수 / 유성 시간
  let syllables = 0
  if (span > 0) {
    const envelope: number[] = []
    for (let i = firstVoiced; i <= lastVoiced; i += 1) envelope.push(frames[i]?.rms ?? 0)
    const smooth = envelope.map((_, i) => {
      const a = envelope[i - 1] ?? envelope[i] ?? 0
      const b = envelope[i] ?? 0
      const c = envelope[i + 1] ?? envelope[i] ?? 0
      return (a + b + c) / 3
    })
    const peakFloor = Math.max(silenceLevel, (percentile(smooth, 0.95) || 0) * 0.3)
    let lastPeak = -10
    for (let i = 1; i < smooth.length - 1; i += 1) {
      const value = smooth[i] ?? 0
      if (value > peakFloor && value > (smooth[i - 1] ?? 0) && value >= (smooth[i + 1] ?? 0) && i - lastPeak >= 3) {
        syllables += 1
        lastPeak = i
      }
    }
  }
  const voicedSeconds = (voicedFrames.length * HOP) / sampleRate
  const syllableRate = voicedSeconds > 0 ? syllables / voicedSeconds : 0

  // 쉼: 말하는 구간 안에서 200ms(약 6프레임) 이상 이어지는 무성 구간
  let pauseCount = 0
  if (span > 0) {
    let silentRun = 0
    for (let i = firstVoiced; i <= lastVoiced; i += 1) {
      if (energetic[i]) {
        if (silentRun >= 6) pauseCount += 1
        silentRun = 0
      } else {
        silentRun += 1
      }
    }
  }

  // 사운드 시그니처용 포락선: 말하는 구간의 프레임 RMS를 최대값으로 정규화
  let envelope: number[] = []
  if (span > 0) {
    const raw: number[] = []
    for (let i = firstVoiced; i <= lastVoiced; i += 1) raw.push(frames[i]?.rms ?? 0)
    const peak = Math.max(...raw, 1e-9)
    envelope = raw.map((value) => Math.min(1, value / peak))
  }

  onProgress?.(1)

  return {
    durationSec,
    sampleRate,
    frameCount,
    voicedFrameCount: voicedFrames.length,
    speechRatio: span > 0 ? voicedFrames.length / span : 0,
    f0Median,
    f0Variation: f0Median > 0 ? f0Iqr / f0Median : 0,
    f0Low: f0s.length > 0 ? percentile(f0s, 0.1) : 0,
    f0High: f0s.length > 0 ? percentile(f0s, 0.9) : 0,
    rmsMean,
    rmsVariation: rmsMean > 0 ? standardDeviation(rmsValues) / rmsMean : 0,
    zcrMean: mean(voicedFrames.map((frame) => frame.zcr)),
    syllableRate,
    pauseCount,
    envelope,
  }
}
