import { SERVICE_NAME } from '../shared/config'
import { Logo } from './components/Logo'
import { TopBar } from './components/TopBar'
import { useI18n } from './i18n/useI18n'

export default function App() {
  const { t } = useI18n()

  return (
    <div className="app">
      <TopBar />
      <main className="main">
        <section className="hero">
          <Logo size={72} />
          <h1 className="hero__title">{SERVICE_NAME}</h1>
          <p className="hero__tagline">{t('app.tagline')}</p>
          <p className="hero__note">{t('shell.placeholder')}</p>
        </section>
      </main>
      <footer className="footer">
        <p>{t('privacy.note')}</p>
      </footer>
    </div>
  )
}
