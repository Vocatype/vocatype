import { PROGRESS_STEPS, type FlowStep } from '../app/flow'
import { useI18n } from '../i18n/useI18n'

/** 녹음 → 생성 → 결과 진행 상태. 메인 화면에서는 그리지 않는다. */
export function StepIndicator({ current }: { current: FlowStep }) {
  const { t } = useI18n()
  const index = (PROGRESS_STEPS as readonly FlowStep[]).indexOf(current)
  if (index < 0) return null

  return (
    <ol className="steps" aria-label={t('steps.label')}>
      {PROGRESS_STEPS.map((step, i) => {
        const state = i < index ? 'is-done' : i === index ? 'is-current' : ''
        return (
          <li key={step} className={`steps__item ${state}`} aria-current={i === index ? 'step' : undefined}>
            <span className="steps__dot" aria-hidden="true" />
            <span className="steps__label">{t(`steps.${step}`)}</span>
          </li>
        )
      })}
    </ol>
  )
}
