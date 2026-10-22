import { describe, expect, it } from 'vitest'
import { ALL_TYPE_CODES } from '../../../shared/typeCode'
import { presentResult } from '../profile/present'
import type { VoiceProfile } from '../profile/types'
import { BUDGET_RESERVE, CARD_HEIGHT, CARD_WIDTH, FOOTER_TOP, clampLines, drawCard, type CardLabels } from './renderCard'

interface TextCall {
  text: string
  x: number
  y: number
  width: number
  align: string
}

/** 글꼴 크기와 글자 종류로 폭을 어림하는 가짜 2D 컨텍스트. 그린 글자의 좌표를 기록한다. */
function fakeContext() {
  const calls: TextCall[] = []
  let fontSize = 16
  const state = { font: '', textAlign: 'left' }
  const measure = (text: string) => {
    let width = 0
    for (const char of text) width += /[ᄀ-ᇿ㄰-㆏가-힯　-〿＀-￯『』“”]/.test(char) ? fontSize : fontSize * 0.58
    return width
  }
  const gradient = { addColorStop: () => undefined }
  const ctx = {
    set font(value: string) {
      state.font = value
      const match = /(\d+)px/.exec(value)
      fontSize = match ? Number(match[1]) : 16
    },
    get font() {
      return state.font
    },
    set textAlign(value: string) {
      state.textAlign = value
    },
    get textAlign() {
      return state.textAlign
    },
    textBaseline: 'alphabetic',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    globalAlpha: 1,
    measureText: (text: string) => ({ width: measure(text) }),
    fillText: (text: string, x: number, y: number) => calls.push({ text, x, y, width: measure(text), align: state.textAlign }),
    fillRect: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arcTo: () => undefined,
    arc: () => undefined,
    closePath: () => undefined,
    stroke: () => undefined,
    fill: () => undefined,
    clip: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    drawImage: () => undefined,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

const labelsKo: CardLabels = {
  serviceName: 'Vocatype',
  tagline: '목소리로 그리는 나의 초상',
  color: '퍼스널 컬러',
  scent: '시그니처 향',
  best: '최고의 짝',
  opposite: '정반대',
  readOf: '『별 헤는 밤』 낭독',
  date: '2026. 10. 19.',
  caption: '이야기 한가운데로 끌어들이는 목소리',
}

const labelsEn: CardLabels = {
  ...labelsKo,
  tagline: 'A portrait drawn by your voice',
  color: 'Personal color',
  scent: 'Signature scent',
  best: 'Best match',
  opposite: 'Polar opposite',
  readOf: 'Reading of “I Wandered Lonely as a Cloud”',
  date: '10/19/2026',
  caption: 'A voice that pulls you into the story',
}

function profileFor(code: string): VoiceProfile {
  const axes = {
    warmth: code[0] === 'W' ? 0.8 : 0.2,
    density: code[1] === 'F' ? 0.8 : 0.2,
    pace: code[2] === 'Q' ? 0.8 : 0.2,
    variation: code[3] === 'V' ? 0.8 : 0.2,
    pitch: 0.4,
    brightness: 0.4,
  }
  return {
    typeCode: code as VoiceProfile['typeCode'],
    axes,
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
  }
}

const MARGIN = 72
const leftOf = (c: TextCall) => (c.align === 'left' ? c.x : c.align === 'center' ? c.x - c.width / 2 : c.x - c.width)

/** 이름이 그대로 그려졌거나, 말줄임된 앞부분으로 그려졌는지. */
function drawnAs(calls: TextCall[], text: string): TextCall | undefined {
  return calls.find((c) => c.text === text || (c.text.endsWith('…') && text.startsWith(c.text.slice(0, -1))))
}

describe('drawCard (027 배치)', () => {
  it.each(['ko', 'en'] as const)('모든 타입(%s)에서 글자가 캔버스 안, 하단 문구 위에 놓이고 궁합 이름이 라벨과 겹치지 않는다', (locale) => {
    const labels = locale === 'ko' ? labelsKo : labelsEn
    for (const code of ALL_TYPE_CODES) {
      const view = presentResult(profileFor(code), null, locale)
      const { ctx, calls } = fakeContext()
      expect(() => drawCard(ctx, view, null, labels), code).not.toThrow()
      const footer = calls.filter((c) => c.y > CARD_HEIGHT - 100)
      const body = calls.filter((c) => c.y <= CARD_HEIGHT - 100)
      expect(footer.map((c) => c.text), `${code} ${locale} footer`).toEqual([`${labels.readOf} · ${labels.serviceName}`])
      for (const call of body) {
        expect(call.y, `${code} ${locale} "${call.text}" y`).toBeLessThanOrEqual(FOOTER_TOP)
        expect(leftOf(call), `${code} ${locale} "${call.text}" left`).toBeGreaterThanOrEqual(MARGIN - 1)
        expect(leftOf(call) + call.width, `${code} ${locale} "${call.text}" right`).toBeLessThanOrEqual(CARD_WIDTH - MARGIN + 1)
      }
      for (const [label, name] of [
        [labels.best, view.match.best.name],
        [labels.opposite, view.match.opposite.name],
      ] as const) {
        const labelCall = calls.find((c) => c.text === label)
        const nameCall = drawnAs(calls, name)
        expect(labelCall && nameCall, `${code} ${locale} match "${name}"`).toBeTruthy()
        expect(nameCall!.y).toBe(labelCall!.y)
        expect(nameCall!.x, `${code} ${locale} "${name}" overlaps label`).toBeGreaterThanOrEqual(labelCall!.x + labelCall!.width + 20)
      }
    }
  })

  it('타입 설명 문단·축 퍼센트·16진수 색 코드·향 노트·통계는 저장 카드에 그리지 않는다', () => {
    const view = presentResult(profileFor('CLMV'), null, 'ko')
    const { ctx, calls } = fakeContext()
    drawCard(ctx, view, null, labelsKo)
    const texts = calls.map((c) => c.text)
    expect(texts.some((t) => t.length > 8 && view.description.includes(t))).toBe(false)
    expect(texts.some((t) => /\d+%$/.test(t))).toBe(false)
    expect(texts.some((t) => /^#[0-9A-F]{6}$/i.test(t))).toBe(false)
    expect(texts.some((t) => view.scent.top.some((note) => t.includes(note)) && t !== view.scent.name)).toBe(false)
    expect(texts.some((t) => /Hz|음절/.test(t))).toBe(false)
    // 남는 것: 코드, 이름, 캡션, 축 라벨, 계절 이름, 향 이름
    expect(texts).toEqual(expect.arrayContaining([view.code.split('').join('  '), view.name, labelsKo.caption, view.color.name, view.scent.name]))
  })

  it('캡션은 이름 아래·축 위에 한 줄로 그리고, 비어 있으면 그 자리를 비워 축이 위로 올라온다', () => {
    const view = presentResult(profileFor('WFQV'), null, 'en')
    const axisLabel = `${view.axes[0]?.letter} ${view.axes[0]?.label}`
    const { ctx, calls } = fakeContext()
    drawCard(ctx, view, null, labelsEn)
    // 영어 이름은 72px에서 두 줄이 되므로 이름의 마지막 줄을 기준으로 본다.
    const nameLines = calls.filter((c) => c.align === 'center' && c.text.length > 2 && view.name.includes(c.text))
    const name = nameLines.sort((a, b) => b.y - a.y)[0]
    const caption = calls.find((c) => c.text === labelsEn.caption)
    const axis = calls.find((c) => c.text === axisLabel)
    expect(name && caption && axis).toBeTruthy()
    expect(caption!.y).toBeGreaterThan(name!.y)
    expect(caption!.y).toBeLessThan(axis!.y)
    expect(caption!.align).toBe('center')

    const { ctx: ctx2, calls: calls2 } = fakeContext()
    drawCard(ctx2, view, null, { ...labelsEn, caption: '' })
    expect(calls2.some((c) => c.text === labelsEn.caption)).toBe(false)
    expect(calls2.find((c) => c.text === axisLabel)!.y).toBeLessThan(axis!.y)

    const long = Array.from({ length: 40 }, (_, i) => `Caption${i}`).join(' ')
    const { ctx: ctx3, calls: calls3 } = fakeContext()
    drawCard(ctx3, view, null, { ...labelsEn, caption: long })
    const drawnCaption = calls3.filter((c) => c.text.startsWith('Caption0'))
    expect(drawnCaption).toHaveLength(1)
    expect(drawnCaption[0]!.text.endsWith('…')).toBe(true)
  })

  it('낭독한 글이 없으면 하단은 "서비스 · 태그라인" 한 줄', () => {
    const view = presentResult(profileFor('CFME'), null, 'ko')
    const { ctx, calls } = fakeContext()
    drawCard(ctx, view, null, { ...labelsKo, readOf: '' })
    expect(calls.filter((c) => c.y > CARD_HEIGHT - 100).map((c) => c.text)).toEqual([`${labelsKo.serviceName} · ${labelsKo.tagline}`])
  })
})

describe('drawCard 예산', () => {
  it('모든 줄 수 제한이 꽉 찬 최악 조합도 하단 문구 위에서, 다음 요소를 위한 예산 60을 남기고 끝난다', () => {
    const base = presentResult(profileFor('WFQV'), null, 'en')
    const long = (n: number) => Array.from({ length: n }, (_, i) => `Word${i}`).join(' ')
    const view = {
      ...base,
      name: long(14), // 72px 굵게로 2줄 이상
      scent: { ...base.scent, name: long(12) }, // 2줄 이상
      match: { ...base.match, best: { ...base.match.best, name: long(12) }, opposite: { ...base.match.opposite, name: long(12) } },
    }
    const { ctx, calls } = fakeContext()
    expect(() => drawCard(ctx, view, null, { ...labelsEn, caption: long(40) })).not.toThrow()
    const body = calls.filter((c) => c.y <= CARD_HEIGHT - 100)
    for (const call of body) {
      expect(call.y, `"${call.text}"`).toBeLessThanOrEqual(FOOTER_TOP)
      expect(leftOf(call)).toBeGreaterThanOrEqual(MARGIN - 1)
      expect(leftOf(call) + call.width).toBeLessThanOrEqual(CARD_WIDTH - MARGIN + 1)
    }
    // 이름 2줄, 향 이름 2줄이 실제로 쓰였는지
    expect(calls.filter((c) => c.text.startsWith('Word') && c.align === 'center').length).toBeGreaterThanOrEqual(2)
    expect(calls.filter((c) => c.text.startsWith('Word') && c.align === 'left').length).toBeGreaterThanOrEqual(4)
    const maxY = Math.max(...body.map((c) => c.y))
    expect(maxY, '최악 조합 최대 y').toBeLessThanOrEqual(FOOTER_TOP - BUDGET_RESERVE)
  })
})

describe('축 막대', () => {
  it('긴 라벨은 글자(W/C 등)를 남기고 막대 폭 안에서 말줄임된다', () => {
    const base = presentResult(profileFor('WFQV'), null, 'en')
    const view = { ...base, axes: base.axes.map((axis) => ({ ...axis, label: 'Extraordinarily long axis label that never ends' })) }
    const { ctx, calls } = fakeContext()
    drawCard(ctx, view, null, labelsEn)
    const labels = calls.filter((c) => /^[WFQV] \S/.test(c.text) && c.text.includes('…'))
    expect(labels).toHaveLength(4)
    const barWidth = (CARD_WIDTH - MARGIN * 2 - 70) / 2
    for (const call of labels) expect(call.width).toBeLessThanOrEqual(barWidth + 0.01)
  })

  it('신호가 부족하면 축을 그리지 않는다', () => {
    const view = { ...presentResult(profileFor('WFQV'), null, 'ko'), quality: 'low-signal' as const }
    const { ctx, calls } = fakeContext()
    drawCard(ctx, view, null, labelsKo)
    expect(calls.some((c) => view.axes.some((axis) => c.text === `${axis.letter} ${axis.label}`))).toBe(false)
  })
})

describe('clampLines', () => {
  it('줄 수를 제한하고 말줄임표를 붙인다', () => {
    expect(clampLines(['a', 'b', 'c'], 2)).toEqual(['a', '…'])
    expect(clampLines(['hello world', 'again'], 1)).toEqual(['hello worl…'])
    expect(clampLines(['one'], 3)).toEqual(['one'])
  })

  it('measure가 있으면 말줄임표를 붙인 줄이 폭 안에 들도록 더 줄인다', () => {
    const measure = (s: string) => s.length * 10
    expect(clampLines(['abcdefghij', 'k'], 1, 60, measure)).toEqual(['abcde…'])
  })
})
