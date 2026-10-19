import { useCallback, useEffect, useRef, useState } from 'react'
import type { FlowStep } from '../app/flow'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { fetchAiConfig, requestPortrait } from '../features/ai/client'
import { analyzeRecording, type AnalysisStage } from '../features/analysis/analyze'
import type { VoiceProfile } from '../features/profile/types'
import type { Capture } from '../features/recorder/types'
import { useI18n } from '../i18n/useI18n'

export interface GenerationResult {
  profile: VoiceProfile
  /** 생성된 초상(data URL). 제공자가 없거나 실패하면 null. */
  portrait: string | null
}

interface Props {
  capture: Capture | null
  onNavigate: (to: FlowStep) => void
  onGenerated: (result: GenerationResult) => void
}

type Stage = AnalysisStage | 'portrait'

interface Progress {
  stage: Stage
  /** 전체 진행률 0..1. 초상 단계는 걸리는 시간을 알 수 없어 0.9에 멈춘 채 애니메이션만 돈다. */
  value: number
}

/** 진행 표시가 깜빡이고 끝나지 않도록 최소로 보여 주는 시간. */
const MIN_DISPLAY_MS = 1400
const INITIAL_PROGRESS: Progress = { stage: 'decoding', value: 0 }

export function GeneratingScreen({ capture, onNavigate, onGenerated }: Props) {
  const { t } = useI18n()
  const [progress, setProgress] = useState<Progress>(INITIAL_PROGRESS)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // 부모가 매 렌더 새 콜백을 만들어도 분석을 다시 돌리지 않도록 최신 참조만 유지한다.
  const onGeneratedRef = useRef(onGenerated)
  useEffect(() => {
    onGeneratedRef.current = onGenerated
  })

  useEffect(() => {
    if (!capture) return
    // 취소·언마운트 시 abort → 분석 루프와 초상 요청이 멈추고, 뒤늦은 콜백도 막힌다.
    const controller = new AbortController()
    const { signal } = controller
    const startedAt = performance.now()

    const run = async () => {
      // 1) 기기 안에서 분석
      const profile = await analyzeRecording(capture.recording, {
        locale: capture.script.locale,
        signal,
        onProgress: (next) => {
          if (!signal.aborted) setProgress({ stage: next.stage, value: next.progress * 0.85 })
        },
      })
      if (signal.aborted) return

      // 2) 제공자가 켜져 있을 때만 초상 요청. 타입 코드와 씨앗만 보낸다.
      let portrait: string | null = null
      const config = await fetchAiConfig()
      if (signal.aborted) return
      if (config.features.portrait) {
        setProgress({ stage: 'portrait', value: 0.9 })
        portrait = await requestPortrait({ typeCode: profile.typeCode, seed: profile.seed }, signal)
        if (signal.aborted) return
      }

      const remaining = MIN_DISPLAY_MS - (performance.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
      if (signal.aborted) return
      setProgress({ stage: 'profiling', value: 1 })
      onGeneratedRef.current({ profile, portrait })
    }

    run().catch(() => {
      if (!signal.aborted) setFailed(true)
    })

    return () => controller.abort()
  }, [capture, attempt])

  const retry = useCallback(() => {
    setFailed(false)
    setProgress(INITIAL_PROGRESS)
    setAttempt((n) => n + 1)
  }, [])

  if (!capture) {
    return (
      <Screen centered title={t('generating.title')} lead={t('result.missing')}>
        <div className="actions">
          <Button onClick={() => onNavigate('record')}>{t('common.retry')}</Button>
        </div>
      </Screen>
    )
  }

  const percent = Math.round(progress.value * 100)
  const stageText = t(`generating.stage.${progress.stage}`)

  return (
    <Screen centered title={t('generating.title')} lead={t('generating.script', { title: capture.script.title })}>
      {failed ? (
        <>
          <p className="generating__error" role="alert">
            {t('generating.error')}
          </p>
          <div className="actions">
            <Button variant="secondary" onClick={() => onNavigate('record')}>
              {t('record.redo')}
            </Button>
            <Button onClick={retry}>{t('record.retry')}</Button>
          </div>
        </>
      ) : (
        <>
          <div
            className={['generating__meter', progress.stage === 'portrait' ? 'is-indeterminate' : ''].filter(Boolean).join(' ')}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent}% · ${stageText}`}
            aria-label={t('generating.title')}
          >
            <div className="generating__bar" style={{ width: `${percent}%` }} />
          </div>
          <p className="generating__stage" role="status">
            {stageText}
          </p>
          <div className="actions">
            <Button variant="ghost" onClick={() => onNavigate('record')}>
              {t('common.cancel')}
            </Button>
          </div>
        </>
      )}
    </Screen>
  )
}
