import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { VoiceReading } from '../features/ai/client'
import { presentResult } from '../features/profile/present'
import type { VoiceProfile } from '../features/profile/types'
import type { Capture } from '../features/recorder/types'
import { formatMessage } from '../i18n/format'
import { I18nProvider } from '../i18n/I18nProvider'
import type { Locale } from '../i18n/locales'
import { messages } from '../i18n/messages'
import { ResultScreen } from './ResultScreen'

/*
 * 결과 화면을 서버 렌더(정적 마크업)해 접근성·표시 규칙을 검사한다.
 * DOM 라이브러리 없이 열림 태그의 속성과 요소의 텍스트만 읽는다. 효과(useEffect)와 캔버스는 실행되지 않는다.
 */

/** React가 텍스트·속성값에 쓰는 이스케이프. 기대 문자열을 마크업과 같은 형태로 맞출 때 쓴다(아래 '헬퍼' 테스트가 React와 대조한다). */
const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }
const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)

/** 열림 태그 하나의 속성을 객체로. */
function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const match of tag.matchAll(/([\w-]+)="([^"]*)"/g)) out[match[1]!] = match[2]!
  return out
}

/** 정규식에 맞는 열림 태그를 모두 찾아 속성 객체 배열로. */
function openingTags(html: string, pattern: RegExp): Record<string, string>[] {
  return [...html.matchAll(pattern)].map((match) => attributes(match[0]))
}

/** 주어진 id를 가진 요소의 안쪽 텍스트(태그 제거, 이스케이프는 그대로). 없으면 null. */
function textOf(html: string, id: string): string | null {
  const match = new RegExp(`<[a-z0-9]+[^>]*\\bid="${id}"[^>]*>(.*?)</`, 's').exec(html)
  return match ? match[1]!.replace(/<[^>]+>/g, '') : null
}

const meters = (html: string) => openingTags(html, /<div[^>]*\brole="meter"[^>]*>/g)

/**
 * 경계 축 하나(밀도 52%)와 비경계 축 셋(80·80·55%)이 섞인 프로필. 타입 코드는 축 값과 일치하는 WFME.
 * 55%는 경계가 아니어야 한다(표시값 < 55 규칙. 규칙 자체는 axisStrength.test.ts가 검사한다).
 */
function makeProfile(overrides: Partial<VoiceProfile> = {}): VoiceProfile {
  return {
    typeCode: 'WFME',
    axes: { warmth: 0.8, density: 0.52, pace: 0.2, variation: 0.45, pitch: 0.4, brightness: 0.4 },
    features: {
      durationSec: 12,
      sampleRate: 16000,
      frameCount: 370,
      energeticFrameCount: 300,
      voicedFrameCount: 250,
      speechRatio: 0.8,
      f0Median: 142,
      f0Variation: 0.2,
      f0Low: 110,
      f0High: 190,
      rmsMean: 0.08,
      rmsVariation: 0.5,
      zcrMean: 0.05,
      tiltMedian: 0.15,
      syllableRate: 4.2,
      pauseCount: 2,
      envelope: Array.from({ length: 300 }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i / 7))),
    },
    seed: 1,
    quality: 'ok',
    ...overrides,
  }
}

const readingKo: VoiceReading = {
  locale: 'ko',
  reading: '목소리가 따뜻하고 꽉 차 있어요. 이야기를 서두르지 않고 고르게 풀어 가요.',
  caption: '천천히 스며드는 이야기꾼',
}

/** 녹음 길이(75,000ms → 1:15)는 프로필의 durationSec(12)과 겹치지 않게 둔다. 머리글이 캡처의 길이를 쓰는지 가려내기 위해. */
const capture: Capture = {
  script: { id: 'seosi', locale: 'ko', title: '서시', author: '윤동주', year: '1941', excerpt: false, lines: ['죽는 날까지 하늘을 우러러'] },
  recording: { blob: new Blob(['x']), mimeType: 'audio/webm', durationMs: 75_000 },
}

interface RenderOptions {
  locale?: Locale
  profile?: VoiceProfile | null
  portrait?: string | null
  reading?: VoiceReading | null
  capture?: Capture | null
  calibration?: boolean
}

function render({ locale = 'ko', profile = makeProfile(), portrait = null, reading = null, capture: captured = null, calibration }: RenderOptions = {}): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <ResultScreen capture={captured} profile={profile} portrait={portrait} reading={reading} calibration={calibration} onNavigate={() => undefined} />
    </I18nProvider>,
  )
}

describe('헬퍼', () => {
  it('escape는 React의 텍스트 이스케이프와 같은 결과를 낸다', () => {
    const raw = `a&b<c>d"e'f`
    expect(renderToStaticMarkup(<p>{raw}</p>)).toBe(`<p>${escape(raw)}</p>`)
    expect(escape(raw)).toBe('a&amp;b&lt;c&gt;d&quot;e&#x27;f')
  })
})

describe('ResultScreen 축 막대', () => {
  it('네 축이 타입 코드 글자 순서로 0~100 눈금의 meter로 읽힌다', () => {
    const view = presentResult(makeProfile(), null, 'ko')
    // 픽스처가 의도한 값인지 먼저 고정한다(경계 하나, 비경계 셋).
    expect(view.axes.map((axis) => axis.letter).join('')).toBe('WFME')
    expect(view.axes.map((axis) => axis.percent)).toEqual([80, 52, 80, 55])

    const html = render()
    // 정상 결과에는 신호 부족 안내가 없어야 한다(아래 low-signal 테스트의 반대 경우).
    expect(html).not.toContain(escape(messages.ko['result.lowSignal']))
    const found = meters(html)
    expect(found).toHaveLength(4)
    view.axes.forEach((axis, i) => {
      const meter = found[i]!
      expect(meter['aria-valuemin'], axis.key).toBe('0')
      expect(meter['aria-valuemax'], axis.key).toBe('100')
      expect(meter['aria-valuenow'], axis.key).toBe(String(axis.percent))
      expect(meter['aria-valuetext'], axis.key).toBe(escape(`${axis.label} ${axis.percent}%`))
      expect(meter['aria-label'], axis.key).toBe(escape(axis.title))
    })

    const lists = openingTags(html, /<ul[^>]*\brole="list"[^>]*>/g)
    expect(lists).toHaveLength(1)
    expect(lists[0]!['aria-label']).toBe(escape(messages.ko['result.axesLabel']))
  })

  it('시각 머리글(글자·라벨·퍼센트)은 보조기기에서 숨긴다', () => {
    const heads = openingTags(render(), /<div[^>]*\bclass="axis__head"[^>]*>/g)
    expect(heads).toHaveLength(4)
    for (const head of heads) expect(head['aria-hidden']).toBe('true')
  })

  it.each(['ko', 'en'] as const)('경계 축만 안내 문구에 연결되고 비경계 축에는 연결이 없다 (%s)', (locale) => {
    const view = presentResult(makeProfile(), null, locale)
    // 픽스처 고정: 밀도(52%)만 경계, 55%인 흐름 축은 경계가 아니다.
    expect(view.axes.filter((axis) => axis.boundary).map((axis) => axis.key)).toEqual(['texture'])

    const html = render({ locale })
    const found = meters(html)
    view.axes.forEach((axis, i) => {
      const meter = found[i]!
      const noteId = `axis-note-${axis.key}`
      if (axis.boundary) {
        expect(meter['aria-describedby'], axis.key).toBe(noteId)
        const other = locale === 'en' ? axis.otherLabel.toLowerCase() : axis.otherLabel
        expect(textOf(html, noteId), axis.key).toBe(escape(formatMessage(messages[locale]['result.axisBoundary'], { other })))
      } else {
        expect(meter['aria-describedby'], axis.key).toBeUndefined()
        expect(textOf(html, noteId), axis.key).toBeNull()
      }
    })
  })

  it('영어 경계 안내는 반대 라벨을 소문자로 쓴다', () => {
    const texture = presentResult(makeProfile(), null, 'en').axes.find((axis) => axis.key === 'texture')!
    // 카탈로그 라벨이 대문자로 시작해야 소문자 변환이 실제로 검사된다.
    expect(texture.otherLabel).not.toBe(texture.otherLabel.toLowerCase())
    const html = render({ locale: 'en' })
    expect(textOf(html, 'axis-note-texture')).toBe(escape(formatMessage(messages.en['result.axisBoundary'], { other: texture.otherLabel.toLowerCase() })))
    expect(html).not.toContain(escape(formatMessage(messages.en['result.axisBoundary'], { other: texture.otherLabel })))
  })

  it('신호가 부족하면 막대 없이 안내만 보인다', () => {
    const html = render({ profile: makeProfile({ quality: 'low-signal' }) })
    expect(meters(html)).toHaveLength(0)
    expect(html).not.toContain('axis-note-')
    expect(html).toContain(escape(messages.ko['result.lowSignal']))
  })
})

describe('ResultScreen 리딩·초상·머리글·버튼', () => {
  it('리딩은 생성 언어와 화면 언어가 같을 때만 보인다', () => {
    const same = render({ locale: 'ko', reading: readingKo })
    expect(same).toContain(escape(messages.ko['result.section.reading']))
    expect(same).toContain(escape(readingKo.reading))
    expect(same).toContain(escape(readingKo.caption))
    expect(same).toContain(escape(messages.ko['result.readingNote']))

    const other = render({ locale: 'en', reading: readingKo })
    expect(other).not.toContain(escape(messages.en['result.section.reading']))
    expect(other).not.toContain(escape(readingKo.reading))
    // 리딩이 빠져도 카탈로그의 타입 설명은 그대로 보인다.
    expect(other).toContain(escape(presentResult(makeProfile(), null, 'en').description))
  })

  it('초상이 없으면 자리표시 초상과 준비 중 안내, 있으면 이미지가 보인다', () => {
    const alt = escape(formatMessage(messages.ko['result.portraitAlt'], { name: presentResult(makeProfile(), null, 'ko').name }))

    const without = render()
    const placeholders = openingTags(without, /<div[^>]*\bclass="portrait portrait--placeholder"[^>]*>/g)
    expect(placeholders).toHaveLength(1)
    expect(placeholders[0]!['role']).toBe('img')
    expect(placeholders[0]!['aria-label']).toBe(alt)
    expect(without).toContain(escape(messages.ko['result.portraitPending']))
    expect(without).not.toContain('<img')

    const dataUrl = 'data:image/png;base64,iVBORw0KGgo='
    const withPortrait = render({ portrait: dataUrl })
    const images = openingTags(withPortrait, /<img[^>]*>/g)
    expect(images).toHaveLength(1)
    expect(images[0]!['src']).toBe(dataUrl)
    expect(images[0]!['alt']).toBe(alt)
    expect(withPortrait).not.toContain('portrait--placeholder')
    expect(withPortrait).not.toContain(escape(messages.ko['result.portraitPending']))
  })

  it('낭독 정보가 있으면 머리글에 제목과 캡처의 녹음 길이를 쓰고, 없으면 머리글 설명이 없다', () => {
    const html = render({ capture })
    expect(html).toContain(escape(formatMessage(messages.ko['result.lead'], { title: '서시', duration: '1:15' })))
    // 프로필의 분석 길이(12초)가 아니라 캡처의 녹음 길이를 써야 한다.
    expect(html).not.toContain(escape(formatMessage(messages.ko['result.lead'], { title: '서시', duration: '0:12' })))
    expect(render()).not.toContain('screen__lead')
  })

  it('저장·다시 하기·처음으로 버튼과 저장 상태 영역이 있다', () => {
    const html = render()
    const buttons = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/gs)].map((match) => match[1]!)
    for (const key of ['result.save', 'common.retry', 'common.home'] as const) expect(buttons, key).toContain(escape(messages.ko[key]))
    expect(openingTags(html, /<p[^>]*\brole="status"[^>]*>/g)).toHaveLength(1)
  })

  it('결과가 없으면 안내와 처음으로 버튼만 보인다', () => {
    const html = render({ profile: null })
    expect(html).toContain(escape(messages.ko['result.missing']))
    expect(html).toContain(escape(messages.ko['common.home']))
    expect(meters(html)).toHaveLength(0)
    for (const key of ['result.section.color', 'result.section.scent', 'result.section.signature', 'result.section.match', 'result.save', 'common.retry'] as const) {
      expect(html, key).not.toContain(escape(messages.ko[key]))
    }
  })
})

describe('ResultScreen 보정용 내보내기(개발용)', () => {
  const calibrationKeys = ['result.calibration.title', 'result.calibration.note', 'result.calibration.export'] as const

  it('기본(플래그 없음)에는 보정용 카드·버튼이 전혀 없다', () => {
    for (const html of [render({ capture }), render({ capture, calibration: false })]) {
      for (const key of calibrationKeys) expect(html, key).not.toContain(escape(messages.ko[key]))
      expect(html).not.toContain('card--dev')
      expect(html).not.toContain('result-calibration')
    }
  })

  it.each(['ko', 'en'] as const)('플래그가 있으면 맨 아래 점선 카드에 안내 문구·내려받기 버튼·상태 영역이 있다 (%s)', (locale) => {
    const html = render({ capture, locale, calibration: true })
    const sections = openingTags(html, /<section[^>]*\bclass="card card--dev"[^>]*>/g)
    expect(sections).toHaveLength(1)
    expect(sections[0]!['aria-labelledby']).toBe('result-calibration')
    expect(textOf(html, 'result-calibration')).toBe(escape(messages[locale]['result.calibration.title']))
    expect(html).toContain(escape(messages[locale]['result.calibration.note']))
    const buttons = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/gs)].map((match) => match[1]!)
    expect(buttons).toContain(escape(messages[locale]['result.calibration.export']))
    // 저장 상태 영역이 하나 더 생기고, 아직 누르지 않았으므로 비어 있다(파일 이름 접두사 "calib"가 없음).
    expect(openingTags(html, /<p[^>]*\brole="status"[^>]*>/g)).toHaveLength(2)
    expect(html).not.toContain('-calib-')
    // 카드는 면책 문구 뒤(화면 맨 아래)에 온다.
    expect(html.indexOf('card--dev')).toBeGreaterThan(html.indexOf(escape(messages[locale]['result.disclaimer'])))
  })

  it('결과가 없으면 플래그가 있어도 보정용 카드가 없다', () => {
    const html = render({ profile: null, calibration: true })
    for (const key of calibrationKeys) expect(html, key).not.toContain(escape(messages.ko[key]))
  })
})
