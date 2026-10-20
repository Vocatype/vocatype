import type { CSSProperties } from 'react'
import { VOICE_LOADER_BARS } from './loaderBars'

/**
 * 생성을 기다리는 동안 보여 주는 장식용 음파. 막대가 엇갈려 오르내려 "지금 작업 중"임을 보여 준다.
 * 진행 상태는 옆의 진행 막대(progressbar)와 단계 문구(status)가 전하므로 보조기기에서는 숨긴다.
 * 외부 이미지 없이 CSS 애니메이션만 쓴다(global.css 의 .voice-loader).
 */
export function VoiceLoader() {
  return (
    <div className="voice-loader" aria-hidden="true">
      {VOICE_LOADER_BARS.map((height, index) => (
        <span key={index} className="voice-loader__bar" style={{ '--h': height, '--i': index } as CSSProperties} />
      ))}
    </div>
  )
}
