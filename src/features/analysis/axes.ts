import type { TypeCode } from '../../../shared/typeCode'
import type { VoiceFeatures } from './features'

export type { TypeCode }

/** 사람이 해석할 수 있는 6개 축. 모두 0..1. */
export interface VoiceAxes {
  /** 낮고 어두운 음색일수록 1. */
  warmth: number
  /** 쉼 없이 꽉 차게 말할수록 1. */
  density: number
  /** 빠르게 말할수록 1. */
  pace: number
  /** 억양과 강약 변화가 클수록 1. */
  variation: number
  /** 높은 목소리일수록 1. */
  pitch: number
  /** 밝은 음색일수록 1. */
  brightness: number
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}

/** [low, high] 구간을 0..1로 선형 사상하고 밖은 잘라 낸다. */
export function mapRange(value: number, low: number, high: number): number {
  if (high === low) return 0.5
  return clamp01((value - low) / (high - low))
}

/** 로그 눈금으로 사상한다. 피치처럼 비율로 느껴지는 값에 쓴다. */
export function mapLog(value: number, low: number, high: number): number {
  if (value <= 0 || low <= 0 || high <= low) return 0.5
  return clamp01((Math.log(value) - Math.log(low)) / (Math.log(high) - Math.log(low)))
}

/** 목소리가 충분히 잡히지 않았는지. 축 값은 기본값(0.5)으로 채운다. */
export function isLowSignal(features: VoiceFeatures): boolean {
  return features.voicedFrameCount < 20 || features.f0Median <= 0
}

export function featuresToAxes(features: VoiceFeatures): VoiceAxes {
  if (isLowSignal(features)) {
    return { warmth: 0.5, density: 0.5, pace: 0.5, variation: 0.5, pitch: 0.5, brightness: 0.5 }
  }
  const pitch = mapLog(features.f0Median, 85, 255)
  const brightness = mapRange(features.zcrMean, 0.03, 0.12)
  const density = mapRange(features.speechRatio, 0.5, 0.95)
  const pace = mapRange(features.syllableRate, 2.5, 6)
  const variation = clamp01(0.6 * mapRange(features.f0Variation, 0.08, 0.3) + 0.4 * mapRange(features.rmsVariation, 0.25, 0.75))
  const warmth = clamp01(1 - (0.6 * pitch + 0.4 * brightness))
  return { warmth, density, pace, variation, pitch, brightness }
}

export function axesToTypeCode(axes: VoiceAxes): TypeCode {
  const a = axes.warmth >= 0.5 ? 'W' : 'C'
  const b = axes.density >= 0.5 ? 'F' : 'L'
  const c = axes.pace >= 0.5 ? 'Q' : 'M'
  const d = axes.variation >= 0.5 ? 'V' : 'E'
  return `${a}${b}${c}${d}`
}

/** 같은 녹음이면 같은 결과가 나오도록, 특징을 반올림해 32비트 해시를 만든다. */
export function seedFromFeatures(features: VoiceFeatures): number {
  const parts = [
    features.f0Median.toFixed(1),
    features.f0Variation.toFixed(3),
    features.rmsMean.toFixed(4),
    features.rmsVariation.toFixed(3),
    features.zcrMean.toFixed(4),
    features.syllableRate.toFixed(2),
    features.speechRatio.toFixed(3),
    features.durationSec.toFixed(2),
  ].join('|')
  let hash = 2166136261
  for (let i = 0; i < parts.length; i += 1) {
    hash ^= parts.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
