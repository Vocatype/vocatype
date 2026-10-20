import { describe, expect, it } from 'vitest'
import { ALL_TYPE_CODES } from '../../../shared/typeCode'
import { presentResult } from '../profile/present'
import type { VoiceProfile } from '../profile/types'
import { CARD_HEIGHT, CARD_WIDTH, clampLines, drawCard, type CardLabels } from './renderCard'
import { wrapText } from './wrapText'

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
  signature: '사운드 시그니처',
  match: '목소리 궁합',
  best: '최고의 짝',
  opposite: '정반대',
  top: '탑',
  middle: '미들',
  base: '베이스',
  readOf: '『별 헤는 밤』 낭독',
  date: '2026. 10. 19.',
  stats: ['평균 음높이 142Hz', '분당 250음절'],
  caption: '이야기 한가운데로 끌어들이는 목소리',
}

const labelsEn: CardLabels = {
  ...labelsKo,
  tagline: 'A portrait drawn by your voice',
  color: 'Personal color',
  scent: 'Signature scent',
  signature: 'Sound signature',
  match: 'Voice match',
  best: 'Best match',
  opposite: 'Polar opposite',
  top: 'Top',
  middle: 'Middle',
  base: 'Base',
  readOf: 'Reading of “I Wandered Lonely as a Cloud”',
  date: '10/19/2026',
  stats: ['Average pitch 142 Hz', '250 syllables per minute'],
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

describe('drawCard', () => {
  it.each(['ko', 'en'] as const)('모든 타입(%s)에서 글자가 캔버스 안, 하단 문구 위에 놓인다', (locale) => {
    const margin = 72
    for (const code of ALL_TYPE_CODES) {
      const view = presentResult(profileFor(code), null, locale)
      const { ctx, calls } = fakeContext()
      expect(() => drawCard(ctx, view, null, locale === 'ko' ? labelsKo : labelsEn), code).not.toThrow()
      const footer = calls.filter((c) => c.y > CARD_HEIGHT - 100)
      const body = calls.filter((c) => c.y <= CARD_HEIGHT - 100)
      expect(footer.length, `${code} ${locale} footer`).toBe(2)
      for (const call of body) {
        expect(call.y, `${code} ${locale} "${call.text}" y`).toBeLessThanOrEqual(CARD_HEIGHT - 120)
        const left = call.align === 'left' ? call.x : call.align === 'center' ? call.x - call.width / 2 : call.x - call.width
        const right = left + call.width
        expect(left, `${code} ${locale} "${call.text}" left`).toBeGreaterThanOrEqual(margin - 1)
        expect(right, `${code} ${locale} "${call.text}" right`).toBeLessThanOrEqual(CARD_WIDTH - margin + 1)
      }
      // 궁합 이름 두 개가 줄 수까지 그대로 그려졌는지
      const measure = (s: string) => ctx.measureText(s).width
      ctx.font = '700 30px x'
      for (const name of [view.match.best.name, view.match.opposite.name]) {
        const expected = clampLines(wrapText(name, (CARD_WIDTH - 144) / 2 - 24, measure), 2, (CARD_WIDTH - 144) / 2 - 24, measure)
        for (const line of expected) expect(calls.some((c) => c.text === line), `${code} ${locale} match line "${line}"`).toBe(true)
      }
    }
  })

  it('궁합 섹션은 하단 문구보다 위에, 통계는 서명 아래에 온다', () => {
    const view = presentResult(profileFor('CLME'), null, 'en')
    const { ctx, calls } = fakeContext()
    drawCard(ctx, view, null, labelsEn)
    const matchTitle = calls.find((c) => c.text === 'VOICE MATCH')
    const readOf = calls.find((c) => c.text === labelsEn.readOf)
    const stat = calls.find((c) => c.text === labelsEn.stats[1])
    expect(matchTitle && readOf && stat).toBeTruthy()
    expect(matchTitle!.y).toBeLessThan(readOf!.y - 150)
    expect(stat!.y).toBeLessThan(matchTitle!.y)
  })

  it('캡션은 설명 아래·축 막대 위에 한 줄로 그리고, 비어 있으면 그리지 않는다', () => {
    const view = presentResult(profileFor('WFQV'), null, 'en')
    const { ctx, calls } = fakeContext()
    drawCard(ctx, view, null, labelsEn)
    const caption = calls.find((c) => c.text === labelsEn.caption)
    const description = calls.filter((c) => view.description.includes(c.text) && c.text.length > 10)
    // 축 막대의 첫 라벨(옛 축 막대 자리)
    const chip = calls.find((c) => c.text === `${view.axes[0]?.letter} ${view.axes[0]?.label}`)
    expect(caption && chip && description.length > 0).toBeTruthy()
    expect(caption!.y).toBeGreaterThan(Math.max(...description.map((c) => c.y)))
    expect(caption!.y).toBeLessThan(chip!.y)
    expect(caption!.align).toBe('center')

    const { ctx: ctx2, calls: calls2 } = fakeContext()
    drawCard(ctx2, view, null, { ...labelsEn, caption: '' })
    expect(calls2.some((c) => c.text === labelsEn.caption)).toBe(false)
    // 캡션이 없으면 그 자리를 비워 축 막대이 위로 올라온다.
    const chip2 = calls2.find((c) => c.text === `${view.axes[0]?.letter} ${view.axes[0]?.label}`)
    expect(chip2!.y).toBeLessThan(chip!.y)

    // 긴 캡션은 한 줄로 말줄임한다.
    const long = Array.from({ length: 40 }, (_, i) => `Caption${i}`).join(' ')
    const { ctx: ctx3, calls: calls3 } = fakeContext()
    drawCard(ctx3, view, null, { ...labelsEn, caption: long })
    const drawnCaption = calls3.filter((c) => c.text.startsWith('Caption0'))
    expect(drawnCaption).toHaveLength(1)
    expect(drawnCaption[0]!.text.endsWith('…')).toBe(true)
  })
})

describe('drawCard 예산', () => {
  it('모든 줄 수 제한이 꽉 찬 최악 조합도 하단 문구 위에서 끝난다', () => {
    const base = presentResult(profileFor('WFQV'), null, 'en')
    const long = (n: number) => Array.from({ length: n }, (_, i) => `Word${i}`).join(' ')
    const view = {
      ...base,
      name: long(14), // 60px 볼드로 2줄 이상
      description: long(60), // 28px로 3줄 이상
      scent: { ...base.scent, name: long(12), top: [long(8), long(8)], middle: [long(8)], base: [long(8)] },
      match: { ...base.match, best: { ...base.match.best, name: long(12) }, opposite: { ...base.match.opposite, name: long(12) } },
    }
    const { ctx, calls } = fakeContext()
    // 캡션도 가장 긴 경우(한 줄 꽉 참 + 말줄임)로 넣는다.
    expect(() => drawCard(ctx, view, null, { ...labelsEn, stats: [long(6), long(6)], caption: long(40) })).not.toThrow()
    const body = calls.filter((c) => c.y <= CARD_HEIGHT - 100)
    for (const call of body) {
      expect(call.y, `"${call.text}"`).toBeLessThanOrEqual(CARD_HEIGHT - 120)
      const left = call.align === 'left' ? call.x : call.align === 'center' ? call.x - call.width / 2 : call.x - call.width
      expect(left).toBeGreaterThanOrEqual(71)
      expect(left + call.width).toBeLessThanOrEqual(CARD_WIDTH - 71)
    }
    // 이름 2줄, 설명 3줄, 캡션 1줄, 궁합 2행이 실제로 쓰였는지
    expect(calls.filter((c) => c.text.startsWith('Word') && c.align === 'center').length).toBeGreaterThanOrEqual(6)
  })
})

describe('축 막대', () => {
  it('긴 라벨은 퍼센트 자리를 남기고 말줄임된다', () => {
    const base = presentResult(profileFor('WFQV'), null, 'en')
    const view = { ...base, axes: base.axes.map((axis) => ({ ...axis, label: 'Extraordinarily long axis label' })) }
    const { ctx, calls } = fakeContext()
    drawCard(ctx, view, null, labelsEn)
    ctx.font = '600 22px x'
    const measure = (s: string) => ctx.measureText(s).width
    const labels = calls.filter((c) => /^[WFQV] \S/.test(c.text) && c.text.includes('…'))
    expect(labels).toHaveLength(4)
    const barWidth = (CARD_WIDTH - 144 - 24 * 3) / 4
    for (const axis of view.axes) {
      const call = labels.find((c) => c.text.startsWith(`${axis.letter} `))
      expect(call, axis.letter).toBeTruthy()
      expect(call!.text.endsWith('…')).toBe(true)
      // 그 축의 퍼센트 자리와 간격 12를 남겨야 한다 (부동소수점 여유 0.01)
      expect(call!.width).toBeLessThanOrEqual(barWidth - measure(`${axis.percent}%`) - 12 + 0.01)
    }
  })

  it('신호가 부족하면 막대를 그리지 않는다', () => {
    const view = { ...presentResult(profileFor('WFQV'), null, 'ko'), quality: 'low-signal' as const }
    const { ctx, calls } = fakeContext()
    drawCard(ctx, view, null, labelsKo)
    expect(calls.some((c) => /^\d+%$/.test(c.text))).toBe(false)
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
