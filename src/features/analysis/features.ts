import { highPass, lowPass, mean, median, percentile, resample, rms, spectralTilt, standardDeviation, yinPitch, zeroCrossingRate } from './dsp'

/** 녹음 한 건에서 뽑은 원시 특징. 숫자는 모두 사람이 읽을 수 있는 단위다. */
export interface VoiceFeatures {
  durationSec: number
  /** 분석에 쓴 샘플레이트(Hz). */
  sampleRate: number
  frameCount: number
  /** 에너지가 있는(말소리·자음·숨 포함) 프레임 수. */
  energeticFrameCount: number
  /** 피치가 잡힌 유성 프레임 수. */
  voicedFrameCount: number
  /** 말하기 시작~끝 구간 중 에너지가 있는 프레임 비율 0..1. 쉼이 적을수록 크다. */
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
  /** 유성 프레임 영교차율 평균. 참고용. */
  zcrMean: number
  /** 피치 신뢰도가 높은 유성 프레임의 스펙트럼 기울기(차분 RMS / RMS) 중앙값. 자음·숨 프레임의 영향을 받지 않는 음색 밝기. */
  tiltMedian: number
  /** 조음 속도: 20ms 포락선의 dB 봉우리 수 / 에너지가 있는 시간(초). 쉼을 뺀 말하기 속도. */
  syllableRate: number
  /** 말하는 구간 안의 쉼(약 220ms 이상 무음) 횟수. */
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
/** 쉼으로 세는 연속 무음 프레임 수. 창 겹침을 고려하면 실제 무음은 약 220ms 이상. */
const PAUSE_FRAMES = 6
/** 기울기 중앙값에 쓰는 프레임의 최소 피치 신뢰도. 자음·숨이 섞인 창을 뺀다. */
const TILT_CONFIDENCE = 0.85
/**
 * 음절 포락선: 30ms 창, 10ms 간격. 피치 창(64ms)보다 짧아야 약한 음절이 강한 음절에 묻히지 않고,
 * 20ms보다 길어야 70Hz 근처 극저음의 주기 리플(약 2dB)이 봉우리로 세어지지 않는다.
 */
const SYLLABLE_WINDOW_SEC = 0.03
const SYLLABLE_HOP_SEC = 0.01
/** 봉우리 조건(dB, 최대값 기준): 바닥, 돌출도, 최소 간격·탐색 폭(홉 수). 9홉 = 90ms → 최대 약 11음절/초. */
const PEAK_FLOOR_DB = -24
const PEAK_PROMINENCE_DB = 3
const PEAK_MIN_GAP_HOPS = 9
const PEAK_SIDE_HOPS = 12

interface Scheduler {
  yield?: () => Promise<void>
}

/** 메인 스레드를 잠깐 놓아 준다. scheduler.yield가 있으면 쓰고, 없으면 MessageChannel 매크로태스크. */
function yieldToEventLoop(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: Scheduler }).scheduler
  if (scheduler && typeof scheduler.yield === 'function') return scheduler.yield()
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'function') {
      const channel = new MessageChannel()
      channel.port1.onmessage = () => {
        channel.port1.close()
        resolve()
      }
      channel.port2.postMessage(null)
    } else {
      setTimeout(resolve, 0)
    }
  })
}

interface FrameInfo {
  rms: number
  zcr: number
  tilt: number
  f0: number | null
  confidence: number
}

export interface ExtractOptions {
  /** 0..1 진행률 */
  onProgress?: (progress: number) => void
  /** 취소. 양보 지점마다 확인해 중단한다. */
  signal?: AbortSignal
}

/**
 * PCM 샘플에서 특징을 뽑는다. 긴 루프는 주기적으로 이벤트 루프에 양보해 화면이 멈추지 않고,
 * signal이 중단되면 다음 양보 지점에서 예외를 던진다.
 */
export async function extractFeatures(
  input: Float32Array,
  inputRate: number,
  options: ExtractOptions = {},
): Promise<VoiceFeatures> {
  const { onProgress, signal } = options
  const sampleRate = ANALYSIS_SAMPLE_RATE
  const samples = highPass(resample(input, inputRate, sampleRate))
  const durationSec = samples.length / sampleRate
  const tauMax = Math.ceil(sampleRate / MIN_HZ)
  const frameCount = Math.max(0, Math.floor((samples.length - WINDOW - tauMax) / HOP) + 1)

  const frames: FrameInfo[] = []
  for (let i = 0; i < frameCount; i += 1) {
    const start = i * HOP
    frames.push({
      rms: rms(samples, start, WINDOW),
      zcr: zeroCrossingRate(samples, start, WINDOW),
      tilt: spectralTilt(samples, start, WINDOW),
      f0: null,
      confidence: 0,
    })
    if (i % YIELD_EVERY_FRAMES === 0) {
      signal?.throwIfAborted()
      onProgress?.((i / Math.max(1, frameCount)) * 0.3)
      await yieldToEventLoop()
    }
  }

  // 에너지 판정: 녹음 안의 상위 에너지 대비 상대 임계값 (마이크 게인 차이를 흡수)
  const loud = percentile(
    frames.map((frame) => frame.rms),
    0.9,
  )
  const silenceLevel = Math.max(0.004, loud * 0.12)
  const energetic = frames.map((frame) => frame.rms > silenceLevel)

  // 피치는 에너지가 있는 프레임에서만 계산
  for (let i = 0; i < frameCount; i += 1) {
    if (i % YIELD_EVERY_FRAMES === 0) {
      signal?.throwIfAborted()
      onProgress?.(0.3 + (i / Math.max(1, frameCount)) * 0.65)
      await yieldToEventLoop()
    }
    if (!energetic[i]) continue
    const estimate = yinPitch(samples, i * HOP, WINDOW, sampleRate, MIN_HZ, MAX_HZ)
    const frame = frames[i]
    if (frame && estimate && estimate.confidence >= PITCH_CONFIDENCE) {
      frame.f0 = estimate.f0
      frame.confidence = estimate.confidence
    }
  }

  const voiced = frames.map((frame, i) => (energetic[i] ?? false) && frame.f0 !== null)
  const voicedFrames = frames.filter((_, i) => voiced[i])
  const firstVoiced = voiced.indexOf(true)
  const lastVoiced = voiced.lastIndexOf(true)
  const span = firstVoiced >= 0 ? lastVoiced - firstVoiced + 1 : 0

  let energeticInSpan = 0
  for (let i = firstVoiced; span > 0 && i <= lastVoiced; i += 1) if (energetic[i]) energeticInSpan += 1

  // 쉼: 말하는 구간 안에서 PAUSE_FRAMES 이상 이어지는 무음 구간
  let pauseCount = 0
  if (span > 0) {
    let silentRun = 0
    for (let i = firstVoiced; i <= lastVoiced; i += 1) {
      if (energetic[i]) {
        if (silentRun >= PAUSE_FRAMES) pauseCount += 1
        silentRun = 0
      } else {
        silentRun += 1
      }
    }
  }
  // 창 겹침 때문에 쉼의 가장자리 프레임이 하나씩 에너지로 세어지므로 쉼마다 한 프레임을 뺀다.
  const energeticAdjusted = Math.max(0, energeticInSpan - pauseCount)

  const f0s = voicedFrames.map((frame) => frame.f0 ?? 0)
  const f0Median = median(f0s)
  const f0Iqr = f0s.length > 0 ? percentile(f0s, 0.75) - percentile(f0s, 0.25) : 0
  const rmsValues = voicedFrames.map((frame) => frame.rms)
  const rmsMean = mean(rmsValues)

  // 조음 속도: 말하는 구간을 모음 대역(≈1kHz 이하)만 남긴 신호로, 20ms 창·10ms 간격의 짧은 포락선으로 다시 훑어
  // dB 눈금에서 봉우리를 센다. 피치용 64ms 창은 약한 음절을 강한 음절의 어깨로 흡수하고,
  // 로우패스 없이는 치찰음·파열음이 음절로 세어진다.
  let syllables = 0
  let envelope: number[] = []
  if (span > 0) {
    const raw: number[] = []
    for (let i = firstVoiced; i <= lastVoiced; i += 1) raw.push(frames[i]?.rms ?? 0)
    let peak = 1e-9
    for (const value of raw) if (value > peak) peak = value
    envelope = raw.map((value) => Math.min(1, value / peak))

    const sylWindow = Math.round(SYLLABLE_WINDOW_SEC * sampleRate)
    const sylHop = Math.round(SYLLABLE_HOP_SEC * sampleRate)
    const spanStart = firstVoiced * HOP
    const spanEnd = Math.min(samples.length, lastVoiced * HOP + WINDOW)
    const vowelBand = lowPass(samples.subarray(spanStart, spanEnd))
    const fine: number[] = []
    for (let pos = 0; pos + sylWindow <= vowelBand.length; pos += sylHop) fine.push(rms(vowelBand, pos, sylWindow))
    let fineMax = 1e-9
    for (const value of fine) if (value > fineMax) fineMax = value
    const db = fine.map((value) => 20 * Math.log10(Math.max(value, 1e-6) / fineMax))
    let lastPeak = -PEAK_MIN_GAP_HOPS
    for (let i = 1; i < db.length - 1; i += 1) {
      const value = db[i] ?? -120
      if (value < PEAK_FLOOR_DB || value <= (db[i - 1] ?? -120) || value < (db[i + 1] ?? -120) || i - lastPeak < PEAK_MIN_GAP_HOPS) continue
      let left = value
      let right = value
      for (let k = 1; k <= PEAK_SIDE_HOPS; k += 1) {
        left = Math.min(left, db[i - k] ?? value)
        right = Math.min(right, db[i + k] ?? value)
      }
      if (value - Math.max(left, right) < PEAK_PROMINENCE_DB) continue
      syllables += 1
      lastPeak = i
    }
  }
  const energeticSeconds = (energeticAdjusted * HOP) / sampleRate
  const syllableRate = energeticSeconds > 0 ? syllables / energeticSeconds : 0

  // 밝기: 피치 신뢰도가 높은 프레임만 모아 중앙값. 부족하면 유성 프레임 전체.
  const confidentTilts = voicedFrames.filter((frame) => frame.confidence >= TILT_CONFIDENCE).map((frame) => frame.tilt)
  const tiltMedian = median(confidentTilts.length >= 5 ? confidentTilts : voicedFrames.map((frame) => frame.tilt))

  onProgress?.(1)

  return {
    durationSec,
    sampleRate,
    frameCount,
    energeticFrameCount: energetic.filter(Boolean).length,
    voicedFrameCount: voicedFrames.length,
    speechRatio: span > 0 ? energeticAdjusted / span : 0,
    f0Median,
    f0Variation: f0Median > 0 ? f0Iqr / f0Median : 0,
    f0Low: f0s.length > 0 ? percentile(f0s, 0.1) : 0,
    f0High: f0s.length > 0 ? percentile(f0s, 0.9) : 0,
    rmsMean,
    rmsVariation: rmsMean > 0 ? standardDeviation(rmsValues) / rmsMean : 0,
    zcrMean: mean(voicedFrames.map((frame) => frame.zcr)),
    tiltMedian,
    syllableRate,
    pauseCount,
    envelope,
  }
}
