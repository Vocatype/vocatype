import type { FlowStep } from '../app/flow'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { useI18n } from '../i18n/useI18n'

interface Props {
  onNavigate: (to: FlowStep) => void
}

/** 자리표시 화면. 005에서 실제 결과 카드로 교체한다. */
export function ResultScreen({ onNavigate }: Props) {
  const { t } = useI18n()
  return (
    <Screen title={t('result.title')} lead={t('placeholder.pending')}>
      <div className="actions">
        <Button variant="secondary" onClick={() => onNavigate('landing')}>
          {t('common.home')}
        </Button>
        <Button onClick={() => onNavigate('record')}>{t('common.retry')}</Button>
      </div>
    </Screen>
  )
}
