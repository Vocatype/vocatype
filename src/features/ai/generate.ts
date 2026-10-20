import type { Locale } from '../../i18n/locales'
import { analyzeRecording, type AnalysisProgress } from '../analysis/analyze'
import type { VoiceProfile } from '../profile/types'
import type { Capture } from '../recorder/types'
import { fetchAiConfig, requestPortrait, requestReading, toReadingAxes, type VoiceReading } from './client'
import { planGeneration } from './reading'

export interface GenerationResult {
  profile: VoiceProfile
  /** 생성된 초상(data URL). 제공자가 없거나 실패하면 null. */
  portrait: string | null
  /** 목소리 리딩. 제공자가 없거나 실패하면 null(결과 화면은 카탈로그 설명으로 폴백). */
  reading: VoiceReading | null
}

/** 분석이 끝난 뒤 생성 요청을 기다리는 단계. 걸리는 시간을 알 수 없다. */
export type WaitingStage = 'portrait' | 'reading'

export interface GenerateOptions {
  /** 리딩 언어. 요청을 보내는 순간(분석이 끝난 뒤)에 읽으므로 분석 중에 화면 언어가 바뀌면 바뀐 언어로 요청한다. */
  getLocale: () => Locale
  /** 취소. 중단되면 거부(reject)되고, 그 뒤로는 콜백을 부르지 않는다. 진행 중인 요청도 끊는다. */
  signal?: AbortSignal
  /** 기기 안 분석의 진행. */
  onProgress?: (progress: AnalysisProgress) => void
  /** 생성 대기 단계. 처음 단계(초상 > 리딩)와, 초상이 먼저 끝났는데 리딩을 아직 기다릴 때의 'reading'. */
  onStage?: (stage: WaitingStage) => void
}

/**
 * 녹음 → 프로필 → 초상·리딩. 표시 시간·진행률 환산은 화면이 정한다.
 * 분석이 실패하면 그 오류로 거부한다. 초상·리딩 요청은 실패해도 null 로 받아 결과로 진행한다.
 */
export async function runGeneration(capture: Capture, options: GenerateOptions): Promise<GenerationResult> {
  const { getLocale, signal, onProgress, onStage } = options
  // 설정 조회는 분석과 동시에 시작해 대기 시간을 겹친다(세션 안에서 한 번만 실제 요청).
  const configPromise = fetchAiConfig()

  // 1) 기기 안에서 분석
  const profile = await analyzeRecording(capture.recording, {
    locale: capture.script.locale,
    signal,
    onProgress: (next) => {
      if (!signal?.aborted) onProgress?.(next)
    },
  })
  signal?.throwIfAborted()

  // 2) 켜져 있는 기능만 병렬로 요청한다. 초상은 타입 코드·씨앗, 리딩은 타입 코드·반올림한 축·언어만 보낸다.
  //    어느 쪽이 실패해도 null 로 받아 결과로 진행한다(초상은 자리표시, 리딩은 카탈로그 설명).
  const config = await configPromise
  signal?.throwIfAborted()
  const plan = planGeneration(config.features, profile.quality)
  if (plan.stage) onStage?.(plan.stage)
  let readingSettled = false
  const portraitPromise = plan.wantPortrait ? requestPortrait({ typeCode: profile.typeCode, seed: profile.seed }, signal) : Promise.resolve(null)
  const readingPromise = plan.wantReading
    ? requestReading({ typeCode: profile.typeCode, axes: toReadingAxes(profile.axes), locale: getLocale() }, signal).finally(() => {
        readingSettled = true
      })
    : Promise.resolve(null)
  // 초상이 먼저 끝났는데 리딩을 아직 기다리면 단계를 리딩으로 바꾼다(요청은 둘 다 null 로 끝나므로 reject 하지 않는다).
  void portraitPromise.then(() => {
    if (plan.wantPortrait && plan.wantReading && !readingSettled && !signal?.aborted) onStage?.('reading')
  })
  const [portrait, reading] = await Promise.all([portraitPromise, readingPromise])
  signal?.throwIfAborted()
  return { profile, portrait, reading }
}
