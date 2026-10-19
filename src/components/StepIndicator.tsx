import { PROGRESS_STEPS, type FlowStep } from '../app/flow'
import { useI18n } from '../i18n/useI18n'

/** 녹음 → 생성 → 결과 진행 상태. 메인 화면에서는 그리지 않는다. */
export function StepIndicator({ current }: { current: FlowStep }) {
  const { t } = useI18n()
  const index = PROGRESS_STEPS.findIndex((step) => step === current)
  if (index < 0) return null

  return (
    <ol className="steps" aria-label={t('steps.label')}>
      {PROGRESS_STEPS.map((step, i) => {
        const done = i < index
        const active = i === index
        const classes = ['steps__item', done ? 'is-done' : '', active ? 'is-current' : ''].filter(Boolean).join(' ')
        return (
          <li key={step} className={classes} aria-current={active ? 'step' : undefined}>
            <span className="steps__dot" aria-hidden="true" />
            <span className="steps__label">{t(`steps.${step}`)}</span>
            {done ? <span className="visually-hidden">{t('steps.done')}</span> : null}
          </li>
        )
      })}
    </ol>
  )
}
