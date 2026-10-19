import { useCallback, useEffect, useRef, useState } from 'react'
import type { FlowStep } from '../app/flow'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { analyzeRecording, type AnalysisProgress } from '../features/analysis/analyze'
import type { VoiceProfile } from '../features/profile/types'
import type { Capture } from '../features/recorder/types'
import { useI18n } from '../i18n/useI18n'

interface Props {
  capture: Capture | null
  onNavigate: (to: FlowStep) => void
  onAnalyzed: (profile: VoiceProfile) => void
}

/** 진행 표시가 깜빡이고 끝나지 않도록 최소로 보여 주는 시간. */
const MIN_DISPLAY_MS = 1400
const INITIAL_PROGRESS: AnalysisProgress = { stage: 'decoding', progress: 0 }

export function GeneratingScreen({ capture, onNavigate, onAnalyzed }: Props) {
  const { t } = useI18n()
  const [progress, setProgress] = useState<AnalysisProgress>(INITIAL_PROGRESS)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // 부모가 매 렌더 새 콜백을 만들어도 분석을 다시 돌리지 않도록 최신 참조만 유지한다.
  const onAnalyzedRef = useRef(onAnalyzed)
  useEffect(() => {
    onAnalyzedRef.current = onAnalyzed
  })

  useEffect(() => {
    if (!capture) return
    let cancelled = false
    const startedAt = performance.now()

    analyzeRecording(capture.recording, (next) => {
      if (!cancelled) setProgress(next)
    })
      .then(async (profile) => {
        const remaining = MIN_DISPLAY_MS - (performance.now() - startedAt)
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
        if (!cancelled) onAnalyzedRef.current(profile)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
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

  const percent = Math.round(progress.progress * 100)

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
          <div className="generating__meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('generating.title')}>
            <div className="generating__bar" style={{ width: `${percent}%` }} />
          </div>
          <p className="generating__stage" role="status">
            {t(`generating.stage.${progress.stage}`)}
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
