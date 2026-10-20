import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RECORDING_MIN_SECONDS } from '../../shared/config'
import type { Recording } from '../features/recorder/types'
import type { RecorderState, RecorderStatus } from '../features/recorder/useRecorder'
import { I18nProvider } from '../i18n/I18nProvider'
import type { Locale } from '../i18n/locales'
import { messages } from '../i18n/messages'
import { RecordScreen } from './RecordScreen'

/*
 * 녹음 화면을 녹음 상태별로 서버 렌더(정적 마크업)해 '다른 글' 버튼이 언제 눌릴 수 있는지 검사한다.
 * 녹음 훅은 마이크·MediaRecorder가 필요하므로 상태만 돌려주는 가짜로 바꾼다. 클릭은 DOM 없이 할 수 없어
 * "녹음이 있는 동안 버튼이 비활성"을 마크업으로 고정한다(019: done에서 글을 바꾸면 읽지 않은 글이 결과로 넘어갔다).
 */

const recorder = vi.hoisted(() => ({ state: null as RecorderState | null }))

vi.mock('../features/recorder/useRecorder', () => ({
  useRecorder: () => ({ ...recorder.state, start: vi.fn(), stop: vi.fn(), reset: vi.fn() }),
}))

const IDLE: RecorderState = { status: 'idle', error: null, elapsedMs: 0, level: 0, recording: null, previewUrl: null }

function take(durationMs: number): Recording {
  return { blob: new Blob([], { type: 'audio/webm' }), mimeType: 'audio/webm', durationMs }
}

function stateFor(status: RecorderStatus, recording: Recording | null = null): RecorderState {
  switch (status) {
    case 'done':
      return { ...IDLE, status, elapsedMs: recording?.durationMs ?? 0, recording, previewUrl: 'blob:preview' }
    case 'error':
      return { ...IDLE, status, error: 'permission-denied' }
    case 'recording':
      return { ...IDLE, status, elapsedMs: 4_000, level: 0.3 }
    default:
      return { ...IDLE, status }
  }
}

function render(state: RecorderState, locale: Locale = 'ko'): string {
  recorder.state = state
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <RecordScreen onNavigate={vi.fn()} onCaptured={vi.fn()} />
    </I18nProvider>,
  )
}

/** 안쪽 텍스트가 정확히 `label`인 버튼의 속성. 없으면 null. 아이콘 버튼(안에 svg)은 대상이 아니다. */
function button(html: string, label: string): Record<string, string> | null {
  for (const match of html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)) {
    if (match[2] !== label) continue
    const attrs: Record<string, string> = {}
    for (const attr of match[1]!.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[attr[1]!] = attr[2]!
    return attrs
  }
  return null
}

const LONG_ENOUGH = take(RECORDING_MIN_SECONDS * 1000 + 9_000)
const TOO_SHORT = take(RECORDING_MIN_SECONDS * 1000 - 1)

describe.each<Locale>(['ko', 'en'])('RecordScreen 다른 글 버튼 (%s)', (locale) => {
  const another = messages[locale]['record.another']
  const generate = messages[locale]['record.generate']

  it.each<RecorderStatus>(['idle', 'error'])('녹음이 없는 %s에서는 누를 수 있다', (status) => {
    const attrs = button(render(stateFor(status), locale), another)
    expect(attrs).not.toBeNull()
    expect(attrs).not.toHaveProperty('disabled')
  })

  it.each<RecorderStatus>(['requesting', 'recording'])('녹음을 시작한 %s에서는 비활성이다', (status) => {
    expect(button(render(stateFor(status), locale), another)).toHaveProperty('disabled')
  })

  it('녹음이 끝나 생성할 수 있는 done에서도 비활성이다', () => {
    const html = render(stateFor('done', LONG_ENOUGH), locale)
    // 결함이 일어나던 바로 그 상태인지 먼저 확인: 생성하기가 활성이다.
    const generateButton = button(html, generate)
    expect(generateButton).not.toBeNull()
    expect(generateButton).not.toHaveProperty('disabled')
    expect(button(html, another)).toHaveProperty('disabled')
  })

  it('너무 짧게 끝난 done에서도 비활성이다', () => {
    const html = render(stateFor('done', TOO_SHORT), locale)
    expect(button(html, generate)).toHaveProperty('disabled')
    expect(button(html, another)).toHaveProperty('disabled')
  })
})
