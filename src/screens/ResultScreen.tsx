import { useEffect, useMemo, useRef, useState } from 'react'
import { SERVICE_NAME } from '../../shared/config'
import type { FlowStep } from '../app/flow'
import { Button } from '../components/Button'
import { PortraitFrame } from '../components/PortraitFrame'
import { Screen } from '../components/Screen'
import { SoundSignature } from '../components/SoundSignature'
import type { VoiceReading } from '../features/ai/client'
import { loadImage, renderCard } from '../features/export/renderCard'
import { canShareFiles, downloadBlob, shareBlob } from '../features/export/save'
import { presentResult, type ResultView } from '../features/profile/present'
import type { VoiceProfile } from '../features/profile/types'
import { formatDuration } from '../features/recorder/recorderSupport'
import type { Capture } from '../features/recorder/types'
import { useI18n } from '../i18n/useI18n'

interface Props {
  capture: Capture | null
  profile: VoiceProfile | null
  /** 생성된 초상(data URL). 006 전까지는 null. */
  portrait: string | null
  /** 목소리 리딩. 없거나 생성 시점 언어와 지금 언어가 다르면 카탈로그 설명만 보인다. */
  reading: VoiceReading | null
  onNavigate: (to: FlowStep) => void
}

type SaveState = 'idle' | 'working' | 'saved' | 'shared' | 'failed' | 'share-blocked'

export function ResultScreen({ capture, profile, portrait, reading, onNavigate }: Props) {
  const { locale, t } = useI18n()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  // 공유 시트 지원 여부는 마운트 시점에 한 번만 판단하면 된다.
  const [shareAvailable] = useState(() => canShareFiles())

  const view = useMemo(() => (profile ? presentResult(profile, capture, locale) : null), [profile, capture, locale])
  // 리딩은 생성 시점 언어로 한 번만 만든다. 언어를 바꾸면 다른 언어의 글을 섞어 보이지 않고 카탈로그 설명으로 돌아간다.
  const shownReading = reading && reading.locale === locale ? reading : null
  const caption = shownReading?.caption ?? ''

  const statLines = view ? [t('result.stat.pitch', { hz: view.stats.pitchHz }), t('result.stat.pace', { count: view.stats.syllablesPerMinute })] : []
  const filename = view ? `${SERVICE_NAME.toLowerCase()}-${view.code}.png` : ''
  const cacheKey = view ? `${locale}|${view.code}|${portrait ? portrait.length : 0}|${caption}` : ''

  // 저장 이미지는 한 번 만들면 재사용한다. 공유 시트는 사용자 제스처 직후에 열려야 하므로,
  // 마운트 뒤 여유 시간에 미리 만들어 두면 "공유"를 눌렀을 때 바로 열 수 있다.
  // Promise를 캐시해 선생성 중에 버튼을 눌러도 렌더가 중복되지 않는다. 실패하면 비워 다음 클릭에서 다시 시도한다.
  const blobCacheRef = useRef<{ key: string; promise: Promise<Blob> } | null>(null)

  const buildBlob = (current: ResultView): Promise<Blob> => {
    const cached = blobCacheRef.current
    if (cached && cached.key === cacheKey) return cached.promise
    const key = cacheKey
    const promise = renderBlob(current)
    blobCacheRef.current = { key, promise }
    promise.catch(() => {
      if (blobCacheRef.current?.key === key) blobCacheRef.current = null
    })
    return promise
  }

  const renderBlob = async (current: ResultView): Promise<Blob> => {
    const image = portrait ? await loadImage(portrait) : null
    return renderCard(current, image, {
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
      readOf: current.scriptTitle ? t('result.readOf', { title: current.scriptTitle }) : '',
      date: new Date().toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US'),
      stats: statLines,
      caption,
    })
  }

  // 마운트·언어 변경 뒤 이미지를 미리 만들어 둔다. 실패해도 버튼을 누를 때 다시 시도한다.
  const prebuildRef = useRef<() => void>(() => undefined)
  useEffect(() => {
    prebuildRef.current = () => {
      if (view) void buildBlob(view).catch(() => undefined)
    }
  })
  useEffect(() => {
    if (!cacheKey) return
    const timer = window.setTimeout(() => prebuildRef.current(), 300)
    return () => window.clearTimeout(timer)
  }, [cacheKey])

  if (!profile || !view) {
    return (
      <Screen centered title={t('result.title')} lead={t('result.missing')}>
        <div className="actions">
          <Button onClick={() => onNavigate('landing')}>{t('common.home')}</Button>
        </div>
      </Screen>
    )
  }

  const save = async (mode: 'download' | 'share') => {
    if (saveState === 'working') return
    setSaveState('working')
    try {
      const blob = await buildBlob(view)
      if (mode === 'share') {
        // 공유 시트의 본문에는 캡션 한 줄을 넣는다(없으면 생략).
        const outcome = await shareBlob(blob, filename, `${SERVICE_NAME} · ${view.name}`, caption || undefined)
        setSaveState(outcome === 'shared' ? 'shared' : 'idle')
      } else {
        downloadBlob(blob, filename)
        setSaveState('saved')
      }
    } catch (error) {
      // 공유 시트는 사용자 제스처 직후에만 열린다. 이미지를 막 만든 경우라면 다시 누르면 캐시로 바로 열린다.
      setSaveState(error instanceof Error && error.name === 'NotAllowedError' ? 'share-blocked' : 'failed')
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
            : saveState === 'share-blocked'
              ? t('result.shareBlocked')
              : ''

  return (
    <Screen
      title={t('result.title')}
      lead={view.scriptTitle ? t('result.lead', { title: view.scriptTitle, duration: formatDuration(view.stats.durationMs) }) : undefined}
    >
      {view.quality === 'low-signal' ? <p className="notice">{t('result.lowSignal')}</p> : null}

      <section className="card card--hero" aria-labelledby="result-type-name">
        <PortraitFrame image={portrait} palette={view.color.palette} signature={view.signature} alt={t('result.portraitAlt', { name: view.name })} />
        {!portrait ? <p className="card__note">{t('result.portraitPending')}</p> : null}
        <p className="type__code">
          <span className="visually-hidden">{t('result.typeCode')} </span>
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

      {shownReading ? (
        <section className="card card--reading" aria-labelledby="result-reading">
          <h2 id="result-reading" className="card__title">
            {t('result.section.reading')}
          </h2>
          <p className="reading__text">{shownReading.reading}</p>
          <p className="reading__caption">{shownReading.caption}</p>
          <p className="card__note">{t('result.readingNote')}</p>
        </section>
      ) : null}

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
        <p className="card__stats">{statLines.join(' · ')}</p>
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
        <Button size="lg" onClick={() => void save('download')} aria-busy={saveState === 'working'} aria-disabled={saveState === 'working'}>
          {t('result.save')}
        </Button>
        {shareAvailable ? (
          <Button size="lg" variant="secondary" onClick={() => void save('share')} aria-busy={saveState === 'working'} aria-disabled={saveState === 'working'}>
            {t('result.share')}
          </Button>
        ) : null}
      </div>
      <p className={['save-status', saveState === 'failed' || saveState === 'share-blocked' ? 'is-error' : ''].filter(Boolean).join(' ')} role="status">
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
