import type { TypeCode, VoiceAxes } from '../analysis/axes'
import type { VoiceFeatures } from '../analysis/features'

export type { Localized } from '../../../shared/catalog'
export type { TypeCode, VoiceAxes, VoiceFeatures }

export interface VoiceProfile {
  typeCode: TypeCode
  axes: VoiceAxes
  features: VoiceFeatures
  /** 같은 녹음이면 같은 값. 이미지 생성 등 무작위 요소의 씨앗. */
  seed: number
  /** 목소리가 거의 잡히지 않았으면 'low-signal'. 결과는 기본값으로 채워진다. */
  quality: 'ok' | 'low-signal'
}
