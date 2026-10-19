import { SERVICE_NAME } from '../../shared/config'
import { Button } from '../components/Button'
import { Logo } from '../components/Logo'
import { Screen } from '../components/Screen'
import { useI18n } from '../i18n/useI18n'

interface Props {
  onStart: () => void
}

function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

export function LandingScreen({ onStart }: Props) {
  const { t } = useI18n()
  const supported = isRecordingSupported()

  return (
    <Screen centered className="landing" icon={<Logo size={96} />} title={SERVICE_NAME} lead={t('app.tagline')}>
      <ol className="howto">
        <li className="howto__item">
          <span className="howto__num" aria-hidden="true">1</span>
          <span>{t('landing.step1')}</span>
        </li>
        <li className="howto__item">
          <span className="howto__num" aria-hidden="true">2</span>
          <span>{t('landing.step2')}</span>
        </li>
        <li className="howto__item">
          <span className="howto__num" aria-hidden="true">3</span>
          <span>{t('landing.step3')}</span>
        </li>
      </ol>

      <div className="landing__cta">
        <Button size="lg" block onClick={onStart} disabled={!supported}>
          {t('landing.start')}
        </Button>
        <p className="landing__hint" role={supported ? undefined : 'alert'}>
          {supported ? t('landing.hint') : t('landing.unsupported')}
        </p>
      </div>
    </Screen>
  )
}
