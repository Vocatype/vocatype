import { Fragment, useCallback, useState } from 'react'
import { canTransition, type FlowStep } from './app/flow'
import { FlowContext } from './app/FlowContext'
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
  const [hasNavigated, setHasNavigated] = useState(false)

  const navigate = useCallback(
    (to: FlowStep) => {
      if (!canTransition(step, to)) {
        if (import.meta.env.DEV) console.warn(`flow: blocked transition ${step} → ${to}`)
        return
      }
      setHasNavigated(true)
      setStep(to)
    },
    [step],
  )

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
    <FlowContext value={{ hasNavigated }}>
      <div className="app">
        <TopBar />
        <main className="main">
          <StepIndicator current={step} />
          {/* 단계가 바뀌면 화면을 새로 마운트해 Screen의 초점·스크롤 처리가 매번 실행되게 한다. */}
          <Fragment key={step}>{screen}</Fragment>
        </main>
        <footer className="footer">
          <p>{t('privacy.note')}</p>
        </footer>
      </div>
    </FlowContext>
  )
}
