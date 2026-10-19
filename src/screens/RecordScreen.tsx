import type { FlowStep } from '../app/flow'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { useI18n } from '../i18n/useI18n'

interface Props {
  onNavigate: (to: FlowStep) => void
}

/** 자리표시 화면. 003에서 실제 녹음 화면으로 교체한다. */
export function RecordScreen({ onNavigate }: Props) {
  const { t } = useI18n()
  return (
    <Screen title={t('record.title')} lead={t('placeholder.pending')}>
      <div className="actions">
        <Button variant="secondary" onClick={() => onNavigate('landing')}>
          {t('common.back')}
        </Button>
        <Button onClick={() => onNavigate('generating')}>{t('record.generate')}</Button>
      </div>
    </Screen>
  )
}
