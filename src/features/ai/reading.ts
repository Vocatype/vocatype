import type { ApiConfigResponse } from '../../../shared/api'
import type { Locale } from '../../i18n/locales'
import type { VoiceReading } from './client'

export interface GenerationPlan {
  wantPortrait: boolean
  wantReading: boolean
  /** 처음 보여 줄 대기 단계. 둘 다 꺼져 있으면 null. */
  stage: 'portrait' | 'reading' | null
}

/**
 * 분석이 끝난 뒤 어떤 생성 요청을 보낼지 정한다.
 * 목소리가 거의 잡히지 않은(low-signal) 녹음은 여섯 축이 모두 기본값(0.5)이라 "이 목소리만을 위한" 글이 될 수 없으므로 리딩을 요청하지 않는다.
 */
export function planGeneration(features: ApiConfigResponse['features'], quality: 'ok' | 'low-signal'): GenerationPlan {
  const wantPortrait = features.portrait
  const wantReading = features.reading && quality !== 'low-signal'
  return { wantPortrait, wantReading, stage: wantPortrait ? 'portrait' : wantReading ? 'reading' : null }
}

/**
 * 결과 화면에 보여 줄 리딩. 생성 시점 언어와 지금 화면 언어가 같을 때만 보여 주고,
 * 다르면 null(카탈로그 설명으로 폴백). 다른 언어의 글을 섞어 보이지 않기 위한 규칙이다.
 */
export function visibleReading(reading: VoiceReading | null, locale: Locale): VoiceReading | null {
  return reading && reading.locale === locale ? reading : null
}
