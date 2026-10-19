import { getVoiceType } from '../../shared/catalog'
import type { FlowStep } from '../app/flow'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import type { VoiceProfile } from '../features/profile/types'
import { useI18n } from '../i18n/useI18n'

interface Props {
  profile: VoiceProfile | null
  onNavigate: (to: FlowStep) => void
}

/** 자리표시 화면. 분석 결과(타입 코드·이름·축 값)만 확인용으로 보여 준다. 005에서 결과 카드로 교체한다. */
export function ResultScreen({ profile, onNavigate }: Props) {
  const { locale, t } = useI18n()
  const type = profile ? getVoiceType(profile.typeCode) : null

  return (
    <Screen title={t('result.title')} lead={profile ? undefined : t('result.missing')}>
      {profile && type ? (
        <dl className="debug">
          <dt>{t('result.typeCode')}</dt>
          <dd>
            {profile.typeCode} · {type.name[locale]}
          </dd>
          <dt>{t('result.axes')}</dt>
          <dd>
            {Object.entries(profile.axes)
              .map(([key, value]) => `${key} ${value.toFixed(2)}`)
              .join(' · ')}
          </dd>
        </dl>
      ) : null}
      <div className="actions">
        <Button variant="secondary" onClick={() => onNavigate('landing')}>
          {t('common.home')}
        </Button>
        <Button onClick={() => onNavigate('record')}>{t('common.retry')}</Button>
      </div>
    </Screen>
  )
}
