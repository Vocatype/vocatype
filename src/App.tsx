import { useCallback, useState } from 'react'
import { canTransition, type FlowStep } from './app/flow'
import { StepIndicator } from './components/StepIndicator'
import { TopBar } from './components/TopBar'
import { useI18n } from './i18n/useI18n'
import { GeneratingScreen } from './screens/GeneratingScreen'
import { LandingScreen } from './screens/LandingScreen'
import { RecordScreen } from './screens/RecordScreen'
import { ResultScreen } from './screens/ResultScreen'

export default function App() {
  const { t } = useI18n()
  const [step, setStep] = useState<FlowStep>('landing')

  const navigate = useCallback((to: FlowStep) => {
    setStep((from) => {
      if (canTransition(from, to)) return to
      if (import.meta.env.DEV) console.warn(`flow: blocked transition ${from} → ${to}`)
      return from
    })
  }, [])

  const screen = (() => {
    switch (step) {
      case 'landing':
        return <LandingScreen onStart={() => navigate('record')} />
      case 'record':
        return <RecordScreen onNavigate={navigate} />
      case 'generating':
        return <GeneratingScreen onNavigate={navigate} />
      case 'result':
        return <ResultScreen onNavigate={navigate} />
    }
  })()

  return (
    <div className="app">
      <TopBar />
      <main className="main">
        <StepIndicator current={step} />
        {screen}
      </main>
      <footer className="footer">
        <p>{t('privacy.note')}</p>
      </footer>
    </div>
  )
}
