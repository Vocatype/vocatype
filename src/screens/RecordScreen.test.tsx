import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RECORDING_MIN_SECONDS } from '../../shared/config'
import type { Recording } from '../features/recorder/types'
import type { RecorderState, RecorderStatus, useRecorder } from '../features/recorder/useRecorder'
import { SCRIPTS, type Script } from '../features/scripts/scripts'
import { formatMessage } from '../i18n/format'
import { I18nProvider } from '../i18n/I18nProvider'
import type { Locale } from '../i18n/locales'
import { messages } from '../i18n/messages'
import { RecordScreen } from './RecordScreen'

/*
 * 녹음 화면을 녹음 상태별로 서버 렌더(정적 마크업)해 읽을 글이 언제 바뀔 수 있는지 검사한다.
 * 녹음 훅은 마이크·MediaRecorder가 필요하므로 상태만 돌려주는 가짜로 바꾼다. 클릭은 DOM 없이 할 수 없어
 * "녹음이 있는 동안 버튼이 비활성"을 마크업으로 고정한다(019: done에서 글을 바꾸면 읽지 않은 글이 결과로 넘어갔다).
 */

const recorder = vi.hoisted(() => ({ state: null as RecorderState | null }))
/** 설정하면 pickScript의 다음 한 번만 이 글을 돌려준다. 화면 언어와 다른 글을 들고 시작하는 상황을 만든다. */
const scripts = vi.hoisted(() => ({ nextPick: null as Script | null }))

vi.mock('../features/recorder/useRecorder', () => ({
  useRecorder: (): ReturnType<typeof useRecorder> => {
    if (!recorder.state) throw new Error('render() 전에 recorder.state가 필요하다')
    return { ...recorder.state, start: vi.fn(), stop: vi.fn(), reset: vi.fn() }
  },
}))

vi.mock('../features/scripts/scripts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/scripts/scripts')>()
  return {
    ...actual,
    pickScript: (...args: Parameters<typeof actual.pickScript>) => {
      const next = scripts.nextPick
      scripts.nextPick = null
      return next ?? actual.pickScript(...args)
    },
  }
})

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

/*
 * 언어 전환 규칙도 같은 조건(scriptLocked)을 쓴다. 화면은 한국어인데 영어 글을 들고 시작하게 해서
 * "영어 화면에서 글을 받은 뒤 한국어로 바꾼 직후"를 만든다.
 */
describe('RecordScreen 언어 전환', () => {
  const english = SCRIPTS.find((script) => script.locale === 'en')!
  const scriptLang = (html: string) => /<article class="script" lang="([a-z]+)">/.exec(html)?.[1]
  const titleOf = (html: string) => /<h2 class="script__title">([^<]*)<\/h2>/.exec(html)?.[1]
  const announcementOf = (html: string) => /<p class="visually-hidden" role="status">([^<]*)<\/p>/.exec(html)?.[1]

  function renderAfterSwitch(state: RecorderState): string {
    scripts.nextPick = english
    const html = render(state, 'ko')
    expect(scripts.nextPick).toBeNull() // 영어 글이 실제로 쓰였다
    return html
  }

  it.each<RecorderStatus>(['idle', 'error'])('녹음이 없는 %s에서는 글을 화면 언어로 바꾸고 새 글을 알린다', (status) => {
    const html = renderAfterSwitch(stateFor(status))
    expect(scriptLang(html)).toBe('ko')
    const title = titleOf(html)
    expect(title).toBeTruthy()
    expect(announcementOf(html)).toBe(formatMessage(messages.ko['record.newScript'], { title: title! }))
  })

  it.each<[RecorderStatus, Recording | null]>([
    ['requesting', null],
    ['recording', null],
    ['done', LONG_ENOUGH],
  ])('녹음이 있는 %s에서는 읽던 글을 그대로 두고 알리지 않는다', (status, recording) => {
    const html = renderAfterSwitch(stateFor(status, recording))
    expect(scriptLang(html)).toBe('en')
    expect(announcementOf(html)).toBe('')
  })
})
