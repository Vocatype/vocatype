import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { messages } from '../i18n/messages'
import { LandingScreen } from './LandingScreen'

/*
 * 메인 화면의 녹음 가능 여부 안내를 정적 렌더로 검사한다.
 * 브라우저 전역(window.isSecureContext, navigator.mediaDevices.getUserMedia, MediaRecorder)은 stub 한다.
 */

interface Environment {
  secure: boolean
  getUserMedia: boolean
  mediaRecorder: boolean
}

function stubEnvironment({ secure, getUserMedia, mediaRecorder }: Environment) {
  vi.stubGlobal('window', { isSecureContext: secure })
  vi.stubGlobal('navigator', getUserMedia ? { mediaDevices: { getUserMedia: () => Promise.resolve() } } : { mediaDevices: undefined })
  vi.stubGlobal('MediaRecorder', mediaRecorder ? class {} : undefined)
}

function render() {
  const html = renderToStaticMarkup(
    <I18nProvider initialLocale="ko">
      <LandingScreen onStart={() => undefined} />
    </I18nProvider>,
  )
  const button = /<button[^>]*>/.exec(html)?.[0] ?? ''
  const hint = /<p class="([^"]*)" role="status">(.*?)<\/p>/s.exec(html)
  return { disabled: /\bdisabled=""/.test(button), hintClass: hint?.[1], hint: hint?.[2] }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const ko = messages.ko

describe('LandingScreen 녹음 가능 여부', () => {
  it('보안 컨텍스트에서 getUserMedia 와 MediaRecorder 가 있으면 시작할 수 있다', () => {
    stubEnvironment({ secure: true, getUserMedia: true, mediaRecorder: true })
    expect(render()).toEqual({ disabled: false, hintClass: 'landing__hint', hint: ko['landing.hint'] })
  })

  it.each([
    ['녹음 API 가 있어도', { secure: false, getUserMedia: true, mediaRecorder: true }],
    // 실제 브라우저는 보안 컨텍스트가 아니면 mediaDevices 자체가 없다. 이때도 미지원이 아니라 HTTPS 안내를 보여야 한다.
    ['mediaDevices 가 없어도', { secure: false, getUserMedia: false, mediaRecorder: true }],
  ])('보안 컨텍스트가 아니면 %s HTTPS 안내와 함께 막는다', (_label, environment) => {
    stubEnvironment(environment)
    expect(render()).toEqual({ disabled: true, hintClass: 'landing__hint is-warning', hint: ko['landing.insecure'] })
  })

  it.each([
    ['getUserMedia', { secure: true, getUserMedia: false, mediaRecorder: true }],
    ['MediaRecorder', { secure: true, getUserMedia: true, mediaRecorder: false }],
  ])('%s 가 없으면 미지원 안내와 함께 막는다', (_label, environment) => {
    stubEnvironment(environment)
    expect(render()).toEqual({ disabled: true, hintClass: 'landing__hint is-warning', hint: ko['landing.unsupported'] })
  })
})
