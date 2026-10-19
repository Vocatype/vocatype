import type { FlowStep } from '../app/flow'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import type { Capture } from '../features/recorder/types'
import { useI18n } from '../i18n/useI18n'

interface Props {
  capture: Capture | null
  onNavigate: (to: FlowStep) => void
}

/** 자리표시 화면. 004에서 실제 분석 진행 화면으로 교체한다. */
export function GeneratingScreen({ capture, onNavigate }: Props) {
  const { t } = useI18n()
  const lead = capture ? t('generating.script', { title: capture.script.title }) : t('placeholder.pending')
  return (
    <Screen centered title={t('generating.title')} lead={lead}>
      <div className="actions">
        <Button variant="secondary" onClick={() => onNavigate('record')}>
          {t('common.cancel')}
        </Button>
        <Button onClick={() => onNavigate('result')}>{t('generating.skip')}</Button>
      </div>
    </Screen>
  )
}
