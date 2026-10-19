import type { Recording } from '../recorder/types'
import type { VoiceProfile } from '../profile/types'
import { axesToTypeCode, featuresToAxes, isLowSignal, seedFromFeatures } from './axes'
import { decodeRecording } from './decode'
import { extractFeatures } from './features'

export type AnalysisStage = 'decoding' | 'extracting' | 'profiling'

export interface AnalysisProgress {
  stage: AnalysisStage
  /** 전체 진행률 0..1 */
  progress: number
}

/** 녹음 → 프로필. 네트워크를 쓰지 않는다. */
export async function analyzeRecording(
  recording: Recording,
  onProgress?: (progress: AnalysisProgress) => void,
): Promise<VoiceProfile> {
  onProgress?.({ stage: 'decoding', progress: 0 })
  const decoded = await decodeRecording(recording.blob)

  onProgress?.({ stage: 'extracting', progress: 0.1 })
  const features = await extractFeatures(decoded.samples, decoded.sampleRate, (p) =>
    onProgress?.({ stage: 'extracting', progress: 0.1 + p * 0.8 }),
  )

  onProgress?.({ stage: 'profiling', progress: 0.95 })
  const axes = featuresToAxes(features)
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
