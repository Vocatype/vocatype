import { describe, expect, it } from 'vitest'
import { ALL_TYPE_CODES } from '../../../shared/typeCode'
import { presentResult } from '../profile/present'
import type { VoiceProfile } from '../profile/types'
import { CARD_HEIGHT, CARD_WIDTH, clampLines, drawCard, type CardLabels } from './renderCard'

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
  serviceName: 'VoicePortrait',
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
      // 궁합 이름 두 개가 실제로 그려졌는지
      expect(calls.some((c) => c.text === view.match.best.name || view.match.best.name.startsWith(c.text.replace(/…$/, ''))), `${code} best`).toBe(true)
      expect(calls.some((c) => c.text === view.match.opposite.name || view.match.opposite.name.startsWith(c.text.replace(/…$/, ''))), `${code} opposite`).toBe(true)
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
})

describe('clampLines', () => {
  it('줄 수를 제한하고 말줄임표를 붙인다', () => {
    expect(clampLines(['a', 'b', 'c'], 2)).toEqual(['a', '…'])
    expect(clampLines(['hello world', 'again'], 1)).toEqual(['hello worl…'])
    expect(clampLines(['one'], 3)).toEqual(['one'])
  })
})
