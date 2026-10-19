import { SERVICE_NAME } from '../../shared/config'
import { Button } from '../components/Button'
import { Logo } from '../components/Logo'
import { Screen } from '../components/Screen'
import { useI18n } from '../i18n/useI18n'

interface Props {
  onStart: () => void
}

type Availability = 'ok' | 'insecure' | 'unsupported'

/** 녹음 가능 여부를 미리 확인한다. 권한 요청은 녹음 화면에서 한다. */
function checkAvailability(): Availability {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure'
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.mediaDevices?.getUserMedia !== 'function' ||
    typeof MediaRecorder === 'undefined'
  ) {
    return 'unsupported'
  }
  return 'ok'
}

export function LandingScreen({ onStart }: Props) {
  const { t } = useI18n()
  const availability = checkAvailability()
  const hint =
    availability === 'ok' ? t('landing.hint') : availability === 'insecure' ? t('landing.insecure') : t('landing.unsupported')

  return (
    <Screen centered className="landing" icon={<Logo size={96} />} title={SERVICE_NAME} lead={t('app.tagline')}>
      <ol className="howto">
        <li className="howto__item">
          <span className="howto__num" aria-hidden="true">
            1
          </span>
          <span className="howto__text">{t('landing.step1')}</span>
        </li>
        <li className="howto__item">
          <span className="howto__num" aria-hidden="true">
            2
          </span>
          <span className="howto__text">{t('landing.step2')}</span>
        </li>
        <li className="howto__item">
          <span className="howto__num" aria-hidden="true">
            3
          </span>
          <span className="howto__text">{t('landing.step3')}</span>
        </li>
      </ol>

      <div className="landing__cta">
        <Button size="lg" block onClick={onStart} disabled={availability !== 'ok'}>
          {t('landing.start')}
        </Button>
        <p className={`landing__hint ${availability === 'ok' ? '' : 'is-warning'}`} role="status">
          {hint}
        </p>
      </div>
    </Screen>
  )
}
