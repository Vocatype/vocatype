import type { Locale } from '../../i18n/locales'
import type { VoiceProfile } from '../profile/types'
import type { Recording } from '../recorder/types'
import { axesToTypeCode, featuresToAxes, isLowSignal, seedFromFeatures } from './axes'
import { decodeRecording } from './decode'
import { extractFeatures } from './features'

export type AnalysisStage = 'decoding' | 'extracting' | 'profiling'

export interface AnalysisProgress {
  stage: AnalysisStage
  /** 전체 진행률 0..1 */
  progress: number
}

export interface AnalyzeOptions {
  /** 낭독한 글의 언어. 조음 속도 범위에 쓴다. */
  locale?: Locale
  onProgress?: (progress: AnalysisProgress) => void
  /** 취소. 중단되면 거부(reject)된다. */
  signal?: AbortSignal
}

/** 녹음 → 프로필. 네트워크를 쓰지 않는다. */
export async function analyzeRecording(recording: Recording, options: AnalyzeOptions = {}): Promise<VoiceProfile> {
  const { locale, onProgress, signal } = options
  signal?.throwIfAborted()
  onProgress?.({ stage: 'decoding', progress: 0 })
  const decoded = await decodeRecording(recording.blob)
  signal?.throwIfAborted()

  onProgress?.({ stage: 'extracting', progress: 0.1 })
  const features = await extractFeatures(decoded.samples, decoded.sampleRate, {
    signal,
    onProgress: (p) => onProgress?.({ stage: 'extracting', progress: 0.1 + p * 0.8 }),
  })

  onProgress?.({ stage: 'profiling', progress: 0.95 })
  const axes = featuresToAxes(features, { locale })
  const profile: VoiceProfile = {
    typeCode: axesToTypeCode(axes),
    axes,
    features,
    seed: seedFromFeatures(features),
    quality: isLowSignal(features) ? 'low-signal' : 'ok',
  }
  onProgress?.({ stage: 'profiling', progress: 1 })
  return profile
}
