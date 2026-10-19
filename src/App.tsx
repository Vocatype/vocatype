import { Fragment, useReducer, useState } from 'react'
import { flowReducer, INITIAL_FLOW_STATE, type FlowStep } from './app/flow'
import { FlowContext } from './app/FlowContext'
import { StepIndicator } from './components/StepIndicator'
import { TopBar } from './components/TopBar'
import type { VoiceProfile } from './features/profile/types'
import type { Capture } from './features/recorder/types'
import { useI18n } from './i18n/useI18n'
import { GeneratingScreen } from './screens/GeneratingScreen'
import { LandingScreen } from './screens/LandingScreen'
import { RecordScreen } from './screens/RecordScreen'
import { ResultScreen } from './screens/ResultScreen'

export default function App() {
  const { t } = useI18n()
  // navigate(dispatch)는 안정적이고, 전이 검사는 리듀서가 현재 단계를 기준으로 한다.
  const [flow, navigate] = useReducer(flowReducer, INITIAL_FLOW_STATE)
  const { step } = flow
  // 녹음 화면이 넘긴 스크립트와 녹음, 분석 결과. 메모리에만 있고 페이지를 닫으면 사라진다.
  const [capture, setCapture] = useState<Capture | null>(null)
  const [profile, setProfile] = useState<VoiceProfile | null>(null)

  /** 메인으로 돌아가면 녹음과 결과를 메모리에서도 버린다. 전이 허용 여부는 리듀서가 판단한다. */
  const go = (to: FlowStep) => {
    if (to === 'landing') {
      setCapture(null)
      setProfile(null)
    }
    navigate(to)
  }

  const screen = (() => {
    switch (step) {
      case 'landing':
        return <LandingScreen onStart={() => go('record')} />
      case 'record':
        return (
          <RecordScreen
            onNavigate={go}
            onCaptured={(next) => {
              setCapture(next)
              setProfile(null)
              go('generating')
            }}
          />
        )
      case 'generating':
        return (
          <GeneratingScreen
            capture={capture}
            onNavigate={go}
            onAnalyzed={(next) => {
              setProfile(next)
              go('result')
            }}
          />
        )
      case 'result':
        return <ResultScreen profile={profile} onNavigate={go} />
    }
  })()

  return (
    <FlowContext value={flow}>
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
