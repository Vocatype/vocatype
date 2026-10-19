import { useMemo, useState } from 'react'
import { SERVICE_NAME } from '../../shared/config'
import type { FlowStep } from '../app/flow'
import { Button } from '../components/Button'
import { PortraitFrame } from '../components/PortraitFrame'
import { Screen } from '../components/Screen'
import { SoundSignature } from '../components/SoundSignature'
import { loadImage, renderCard } from '../features/export/renderCard'
import { canShareFiles, downloadBlob, shareBlob } from '../features/export/save'
import { presentResult } from '../features/profile/present'
import type { VoiceProfile } from '../features/profile/types'
import { formatDuration } from '../features/recorder/recorderSupport'
import type { Capture } from '../features/recorder/types'
import { useI18n } from '../i18n/useI18n'

interface Props {
  capture: Capture | null
  profile: VoiceProfile | null
  /** 생성된 초상(data URL). 006 전까지는 null. */
  portrait: string | null
  onNavigate: (to: FlowStep) => void
}

type SaveState = 'idle' | 'working' | 'saved' | 'shared' | 'failed'

export function ResultScreen({ capture, profile, portrait, onNavigate }: Props) {
  const { locale, t } = useI18n()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  // 공유 시트 지원 여부는 마운트 시점에 한 번만 판단하면 된다.
  const [shareAvailable] = useState(() => canShareFiles())

  const view = useMemo(() => (profile ? presentResult(profile, capture, locale) : null), [profile, capture, locale])

  if (!profile || !view) {
    return (
      <Screen centered title={t('result.title')} lead={t('result.missing')}>
        <div className="actions">
          <Button onClick={() => onNavigate('landing')}>{t('common.home')}</Button>
        </div>
      </Screen>
    )
  }

  const statsText = `${t('result.stat.pitch', { hz: view.stats.pitchHz })} · ${t('result.stat.pace', { count: view.stats.syllablesPerMinute })}`
  const filename = `${SERVICE_NAME.toLowerCase()}-${view.code}.png`

  const buildBlob = async () => {
    const image = portrait ? await loadImage(portrait) : null
    return renderCard(view, image, {
      serviceName: SERVICE_NAME,
      tagline: t('app.tagline'),
      color: t('result.section.color'),
      scent: t('result.section.scent'),
      signature: t('result.section.signature'),
      match: t('result.section.match'),
      best: t('result.match.best'),
      opposite: t('result.match.opposite'),
      top: t('result.notes.top'),
      middle: t('result.notes.middle'),
      base: t('result.notes.base'),
      readOf: view.scriptTitle ? t('result.readOf', { title: view.scriptTitle }) : '',
      date: new Date().toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US'),
      stats: statsText,
    })
  }

  const save = async (mode: 'download' | 'share') => {
    setSaveState('working')
    try {
      const blob = await buildBlob()
      if (mode === 'share') {
        const outcome = await shareBlob(blob, filename, `${SERVICE_NAME} · ${view.name}`)
        setSaveState(outcome === 'shared' ? 'shared' : 'idle')
      } else {
        downloadBlob(blob, filename)
        setSaveState('saved')
      }
    } catch {
      setSaveState('failed')
    }
  }

  const saveMessage =
    saveState === 'working'
      ? t('result.saving')
      : saveState === 'saved'
        ? t('result.saved')
        : saveState === 'shared'
          ? t('result.shared')
          : saveState === 'failed'
            ? t('result.saveFailed')
            : ''

  return (
    <Screen
      className="result"
      title={t('result.title')}
      lead={view.scriptTitle ? t('result.lead', { title: view.scriptTitle, duration: formatDuration(view.stats.durationMs) }) : undefined}
    >
      {view.quality === 'low-signal' ? (
        <p className="notice" role="status">
          {t('result.lowSignal')}
        </p>
      ) : null}

      <section className="card card--hero" aria-labelledby="result-type-name">
        <PortraitFrame
          image={portrait}
          palette={view.color.palette}
          signature={view.signature}
          alt={t('result.portraitAlt', { name: view.name })}
          signatureTitle={t('result.section.signature')}
        />
        {!portrait ? <p className="card__note">{t('result.portraitPending')}</p> : null}
        <p className="type__code" aria-label={t('result.typeCode')}>
          {view.code}
        </p>
        <h2 id="result-type-name" className="type__name">
          {view.name}
        </h2>
        <p className="type__description">{view.description}</p>
        <ul className="chips" aria-label={t('result.axesLabel')}>
          {view.axisLabels.map((label) => (
            <li key={label} className="chip">
              {label}
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="result-color">
        <h2 id="result-color" className="card__title">
          {t('result.section.color')}
        </h2>
        <p className="card__headline">{view.color.name}</p>
        <ul className="swatches">
          {view.color.palette.map((hex) => (
            <li key={hex} className="swatch">
              <span className="swatch__color" style={{ background: hex }} aria-hidden="true" />
              <span className="swatch__hex">{hex.toUpperCase()}</span>
            </li>
          ))}
        </ul>
        <p className="card__text">{view.color.description}</p>
      </section>

      <section className="card" aria-labelledby="result-scent">
        <h2 id="result-scent" className="card__title">
          {t('result.section.scent')}
        </h2>
        <p className="card__headline">{view.scent.name}</p>
        <dl className="notes">
          <div className="notes__row">
            <dt>{t('result.notes.top')}</dt>
            <dd>{view.scent.top.join(', ')}</dd>
          </div>
          <div className="notes__row">
            <dt>{t('result.notes.middle')}</dt>
            <dd>{view.scent.middle.join(', ')}</dd>
          </div>
          <div className="notes__row">
            <dt>{t('result.notes.base')}</dt>
            <dd>{view.scent.base.join(', ')}</dd>
          </div>
        </dl>
        <p className="card__text">{view.scent.mood}</p>
      </section>

      <section className="card card--signature" aria-labelledby="result-signature">
        <h2 id="result-signature" className="card__title">
          {t('result.section.signature')}
        </h2>
        <SoundSignature values={view.signature} size={220} title={t('result.section.signature')} className="signature" />
        <p className="card__text">{t('result.signatureCaption')}</p>
        <p className="card__stats">{statsText}</p>
      </section>

      <section className="card" aria-labelledby="result-match">
        <h2 id="result-match" className="card__title">
          {t('result.section.match')}
        </h2>
        <div className="match">
          <div className="match__item">
            <p className="match__label">{t('result.match.best')}</p>
            <p className="match__name">{view.match.best.name}</p>
            <p className="match__code">{view.match.best.code}</p>
            <p className="card__text">{view.match.bestReason}</p>
          </div>
          <div className="match__item">
            <p className="match__label">{t('result.match.opposite')}</p>
            <p className="match__name">{view.match.opposite.name}</p>
            <p className="match__code">{view.match.opposite.code}</p>
            <p className="card__text">{view.match.oppositeReason}</p>
          </div>
        </div>
      </section>

      <div className="actions">
        <Button size="lg" onClick={() => void save('download')} disabled={saveState === 'working'}>
          {t('result.save')}
        </Button>
        {shareAvailable ? (
          <Button size="lg" variant="secondary" onClick={() => void save('share')} disabled={saveState === 'working'}>
            {t('result.share')}
          </Button>
        ) : null}
      </div>
      <p className={['save-status', saveState === 'failed' ? 'is-error' : ''].filter(Boolean).join(' ')} role="status">
        {saveMessage}
      </p>

      <div className="actions actions--secondary">
        <Button variant="secondary" onClick={() => onNavigate('record')}>
          {t('common.retry')}
        </Button>
        <Button variant="ghost" onClick={() => onNavigate('landing')}>
          {t('common.home')}
        </Button>
      </div>
      <p className="disclaimer">{t('result.disclaimer')}</p>
    </Screen>
  )
}
