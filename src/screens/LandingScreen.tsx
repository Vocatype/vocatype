import { SERVICE_NAME } from '../../shared/config'
import { Button } from '../components/Button'
import { Logo } from '../components/Logo'
import { Screen } from '../components/Screen'
import { isRecordingSupported } from '../features/recorder/recorderSupport'
import { useI18n } from '../i18n/useI18n'

interface Props {
  onStart: () => void
}

type Availability = 'ok' | 'insecure' | 'unsupported'

/**
 * 녹음 가능 여부를 미리 확인한다. 권한 요청은 녹음 화면에서 한다.
 * 보안 컨텍스트가 아니면 브라우저가 mediaDevices 자체를 숨기므로, 미지원보다 먼저 HTTPS 안내를 고른다.
 * 녹음 API 판정은 녹음 훅(useRecorder)과 같은 isRecordingSupported 를 쓴다.
 */
function checkAvailability(): Availability {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure'
  return isRecordingSupported() ? 'ok' : 'unsupported'
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
        <p className={['landing__hint', availability === 'ok' ? '' : 'is-warning'].filter(Boolean).join(' ')} role="status">
          {hint}
        </p>
      </div>
    </Screen>
  )
}
