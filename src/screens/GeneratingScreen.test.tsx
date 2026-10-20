import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VOICE_LOADER_BARS } from '../components/loaderBars'
import type { Capture } from '../features/recorder/types'
import { I18nProvider } from '../i18n/I18nProvider'
import { messages } from '../i18n/messages'
import { GeneratingScreen } from './GeneratingScreen'

/*
 * 생성 화면의 첫 렌더(진행 중 상태)를 정적 마크업으로 검사한다.
 * 효과(분석·요청)는 서버 렌더에서 실행되지 않으므로 네트워크·오디오 없이 표시 규칙만 본다.
 */

const capture: Capture = {
  script: { id: 'seosi', locale: 'ko', title: '서시', author: '윤동주', year: '1941', excerpt: false, lines: ['죽는 날까지 하늘을 우러러'] },
  recording: { blob: new Blob(['x']), mimeType: 'audio/webm', durationMs: 12_000 },
}

function render(): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale="ko">
      <GeneratingScreen capture={capture} onNavigate={() => undefined} onGenerated={() => undefined} />
    </I18nProvider>,
  )
}

describe('GeneratingScreen 로딩 표시', () => {
  it('진행 중에는 음파 로더가 보이고, 장식이라 보조기기에서 숨긴다', () => {
    const html = render()
    const loader = html.match(/<div[^>]*class="voice-loader"[^>]*>/)?.[0] ?? ''
    expect(loader).toContain('aria-hidden="true"')
    expect(html.match(/class="voice-loader__bar"/g)).toHaveLength(VOICE_LOADER_BARS.length)
  })

  it('막대마다 높이(--h)와 순번(--i)을 스타일 변수로 받는다', () => {
    const html = render()
    expect(html).toContain(`--h:${VOICE_LOADER_BARS[0]};--i:0`)
    expect(html).toContain(`--h:${VOICE_LOADER_BARS[VOICE_LOADER_BARS.length - 1]};--i:${VOICE_LOADER_BARS.length - 1}`)
  })

  it('진행 상태는 지금처럼 진행 막대와 단계 문구가 전한다(음파는 그 위에 더할 뿐)', () => {
    const html = render()
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('role="status"')
    expect(html).toContain(messages.ko['generating.stage.decoding'])
    expect(html.indexOf('voice-loader')).toBeLessThan(html.indexOf('role="progressbar"'))
  })
})
