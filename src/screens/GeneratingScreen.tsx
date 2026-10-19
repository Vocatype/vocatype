import type { FlowStep } from '../app/flow'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { useI18n } from '../i18n/useI18n'

interface Props {
  onNavigate: (to: FlowStep) => void
}

/** 자리표시 화면. 004·005에서 실제 분석·생성 진행 화면으로 교체한다. */
export function GeneratingScreen({ onNavigate }: Props) {
  const { t } = useI18n()
  return (
    <Screen centered title={t('generating.title')} lead={t('placeholder.pending')}>
      <div className="actions">
        <Button variant="secondary" onClick={() => onNavigate('record')}>
          {t('common.cancel')}
        </Button>
        <Button onClick={() => onNavigate('result')}>{t('generating.skip')}</Button>
      </div>
    </Screen>
  )
}
