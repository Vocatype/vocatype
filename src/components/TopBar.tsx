import { SERVICE_NAME } from '../../shared/config'
import { LOCALES } from '../i18n/locales'
import { useI18n } from '../i18n/useI18n'
import { nextPreference, type ThemePreference } from '../theme/theme'
import { useTheme } from '../theme/useTheme'
import { Logo } from './Logo'

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
  if (preference === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    )
  }
  if (preference === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TopBar() {
  const { locale, setLocale, t } = useI18n()
  const { preference, setPreference } = useTheme()

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <Logo size={28} />
        <span className="topbar__name">{SERVICE_NAME}</span>
      </div>
      <div className="topbar__controls">
        <div className="segmented" role="group" aria-label={t('topbar.language')}>
          {LOCALES.map((item) => (
            <button
              key={item}
              type="button"
              className="segmented__item"
              aria-pressed={locale === item}
              lang={item}
              onClick={() => setLocale(item)}
            >
              {t(`locale.${item}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={`${t('topbar.theme')}: ${t(`theme.${preference}`)}`}
          title={`${t('topbar.theme')}: ${t(`theme.${preference}`)}`}
          onClick={() => setPreference(nextPreference(preference))}
        >
          <ThemeIcon preference={preference} />
        </button>
      </div>
    </header>
  )
}
