import { useEffect, useMemo, useState } from 'react'
import { RECORDING_MAX_SECONDS, RECORDING_MIN_SECONDS } from '../../shared/config'
import type { FlowStep } from '../app/flow'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { formatDuration } from '../features/recorder/recorderSupport'
import type { Capture } from '../features/recorder/types'
import { useRecorder } from '../features/recorder/useRecorder'
import { pickScript, type Script } from '../features/scripts/scripts'
import { useI18n } from '../i18n/useI18n'

interface Props {
  onNavigate: (to: FlowStep) => void
  onCaptured: (capture: Capture) => void
}

function MicIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

export function RecordScreen({ onNavigate, onCaptured }: Props) {
  const { locale, t } = useI18n()
  const [script, setScript] = useState<Script>(() => pickScript(locale))
  const recorder = useRecorder({ maxMs: RECORDING_MAX_SECONDS * 1000 })
  const { status, error, elapsedMs, level, recording } = recorder

  // UI 언어가 바뀌면 읽을 글도 그 언어로 바꾼다. 렌더 중 상태 조정 패턴(effect 없이 즉시 반영).
  // 녹음 중이거나 녹음이 끝난 뒤에는 읽은 글과 결과가 어긋나지 않게 유지하고, 다시 녹음할 때 바꾼다.
  if (script.locale !== locale && (status === 'idle' || status === 'error')) {
    setScript(pickScript(locale))
  }

  // 미리 듣기 URL. 녹음이 바뀌거나 화면이 사라지면 해제한다.
  const previewUrl = useMemo(() => (recording ? URL.createObjectURL(recording.blob) : null), [recording])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const isBusy = status === 'recording' || status === 'requesting'
  const minMs = RECORDING_MIN_SECONDS * 1000
  const tooShort = recording !== null && recording.durationMs < minMs
  const canGenerate = recording !== null && !tooShort

  const shuffle = () => setScript(pickScript(locale, script.id))

  const toggle = () => {
    if (status === 'recording') recorder.stop()
    else if (status === 'idle' || status === 'done' || status === 'error') void recorder.start()
  }

  const hint = (() => {
    switch (status) {
      case 'requesting':
        return t('record.requesting')
      case 'recording':
        return t('record.recordingHint')
      case 'done':
        return tooShort ? t('record.tooShort', { seconds: RECORDING_MIN_SECONDS }) : t('record.doneHint')
      case 'error':
        return error ? t(`record.error.${error}`) : t('record.error.unknown')
      default:
        return t('record.idleHint')
    }
  })()

  return (
    <Screen title={t('record.title')} lead={t('record.lead')}>
      <article className="script" lang={script.locale} aria-live="polite">
        <header className="script__header">
          <div>
            <h2 className="script__title">{script.title}</h2>
            <p className="script__meta">{t('record.scriptMeta', { author: script.author, year: script.year })}</p>
          </div>
          {script.excerpt ? <span className="script__badge">{t('record.excerpt')}</span> : null}
        </header>
        <div className="script__body">
          {script.lines.map((line, index) =>
            line ? (
              <p key={index} className="script__line">
                {line}
              </p>
            ) : (
              <p key={index} className="script__gap" aria-hidden="true" />
            ),
          )}
        </div>
        <footer className="script__footer">
          <span className="script__note">{t('record.publicDomain')}</span>
          <Button variant="ghost" onClick={shuffle} disabled={isBusy}>
            {t('record.another')}
          </Button>
        </footer>
      </article>

      <div className="recorder">
        <div className="recorder__stage">
          <span
            className={`recorder__ring ${status === 'recording' ? 'is-active' : ''}`}
            style={{ transform: `scale(${1 + level * 0.8})`, opacity: 0.25 + level * 0.5 }}
            aria-hidden="true"
          />
          <button
            type="button"
            className={`recorder__button ${status === 'recording' ? 'is-recording' : ''}`}
            onClick={toggle}
            disabled={status === 'requesting'}
            aria-label={status === 'recording' ? t('record.stop') : t('record.start')}
          >
            {status === 'recording' ? <StopIcon /> : <MicIcon />}
          </button>
        </div>
        <p className="recorder__timer" aria-live="off">
          <span className="recorder__elapsed">{formatDuration(elapsedMs)}</span>
          <span className="recorder__max"> / {formatDuration(RECORDING_MAX_SECONDS * 1000)}</span>
        </p>
        <p className={`recorder__hint ${status === 'error' || tooShort ? 'is-error' : ''}`} role="status">
          {hint}
        </p>
      </div>

      {recording && previewUrl ? (
        <div className="preview">
          <audio className="preview__player" controls preload="metadata" src={previewUrl} aria-label={t('record.previewLabel')} />
        </div>
      ) : null}

      <div className="actions">
        {status === 'done' ? (
          <>
            <Button variant="secondary" onClick={recorder.reset}>
              {t('record.redo')}
            </Button>
            <Button
              size="lg"
              disabled={!canGenerate}
              onClick={() => {
                if (recording) onCaptured({ script, recording })
              }}
            >
              {t('record.generate')}
            </Button>
          </>
        ) : status === 'error' ? (
          <Button variant="secondary" onClick={() => void recorder.start()}>
            {t('record.retry')}
          </Button>
        ) : null}
      </div>

      <div className="actions actions--secondary">
        <Button variant="ghost" onClick={() => onNavigate('landing')}>
          {t('common.back')}
        </Button>
      </div>
    </Screen>
  )
}
