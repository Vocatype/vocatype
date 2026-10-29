import { describe, expect, it } from 'vitest'
import { ALL_TYPE_CODES } from '../../../shared/typeCode'
import { presentResult, type ResultView } from '../profile/present'
import type { VoiceProfile } from '../profile/types'
import { SIGNATURE_BINS } from '../signature/signature'
import { BUDGET_RESERVE, CARD_HEIGHT, CARD_WIDTH, FOOTER_TOP, clampLines, drawCard, type CardLabels } from './renderCard'

interface TextCall {
  text: string
  x: number
  y: number
  width: number
  align: string
  /** 글꼴 크기(px). 글자 상자 높이에 쓴다. */
  size: number
}

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** stroke·fill로 그린 경로 하나의 경계 상자(028). */
interface ShapeCall {
  /** arcTo가 있으면 둥근 사각형, arc가 있으면 원, 둘 다 없으면 선. */
  kind: 'line' | 'circle' | 'rounded'
  op: 'stroke' | 'fill'
  box: Box
  /** clip 안에서 그렸는지(자리표시 초상 안의 고리). */
  clipped: boolean
}

/** 가짜 폭에서만 0.05em인 채움 글자. 긴 이름을 이 글자로 채우면 줄이 폭 한도 바로 앞(48px에서 2.4px 안)까지 찬다(028 1차 리뷰 #1). */
const FILL = 'ı'

/**
 * 글꼴 크기와 글자 종류로 폭을 어림하는 가짜 2D 컨텍스트. 그린 글자의 좌표와 도형의 경계 상자를 기록한다.
 * 도형: beginPath로 경로를 열고 moveTo·lineTo는 점, arc는 원 전체 상자, arcTo는 두 제어점을 넣는다. stroke는 선 굵기의 절반만큼 넓힌다.
 * fillRect(바탕·아우라)와 drawImage(초상)는 글자 뒤에 깔리는 것이라 기록하지 않는다.
 */
function fakeContext() {
  const calls: TextCall[] = []
  const shapes: ShapeCall[] = []
  let fontSize = 16
  const state = { font: '', textAlign: 'left', textBaseline: 'alphabetic', lineWidth: 1, clipped: false }
  const saved: { lineWidth: number; clipped: boolean }[] = []
  let points: [number, number][] = []
  let kind: ShapeCall['kind'] = 'line'
  const measure = (text: string) => {
    let width = 0
    for (const char of text) width += char === FILL ? fontSize * 0.05 : /[ᄀ-ᇿ㄰-㆏가-힯　-〿＀-￯『』“”]/.test(char) ? fontSize : fontSize * 0.58
    return width
  }
  const commit = (op: ShapeCall['op']) => {
    if (points.length === 0) return
    const pad = op === 'stroke' ? state.lineWidth / 2 : 0
    const xs = points.map(([x]) => x)
    const ys = points.map(([, y]) => y)
    shapes.push({
      kind,
      op,
      clipped: state.clipped,
      box: { left: Math.min(...xs) - pad, top: Math.min(...ys) - pad, right: Math.max(...xs) + pad, bottom: Math.max(...ys) + pad },
    })
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
    set lineWidth(value: number) {
      state.lineWidth = value
    },
    get lineWidth() {
      return state.lineWidth
    },
    set textBaseline(value: string) {
      state.textBaseline = value
    },
    get textBaseline() {
      return state.textBaseline
    },
    fillStyle: '',
    strokeStyle: '',
    lineCap: 'butt',
    globalAlpha: 1,
    measureText: (text: string) => ({ width: measure(text) }),
    fillText: (text: string, x: number, y: number) => {
      // 글자 상자(textBox)는 alphabetic 기준선을 전제로 한다. 기준선이 바뀌면 상자가 어긋나므로 바로 실패시킨다(028 1차 리뷰 #3).
      if (state.textBaseline !== 'alphabetic') throw new Error(`fake context supports only alphabetic baseline, got ${state.textBaseline}`)
      calls.push({ text, x, y, width: measure(text), align: state.textAlign, size: fontSize })
    },
    fillRect: () => undefined,
    beginPath: () => {
      points = []
      kind = 'line'
    },
    moveTo: (x: number, y: number) => {
      points.push([x, y])
    },
    lineTo: (x: number, y: number) => {
      points.push([x, y])
    },
    arcTo: (x1: number, y1: number, x2: number, y2: number) => {
      points.push([x1, y1], [x2, y2])
      kind = 'rounded'
    },
    arc: (x: number, y: number, r: number) => {
      points.push([x - r, y - r], [x + r, y + r])
      if (kind === 'line') kind = 'circle'
    },
    closePath: () => undefined,
    stroke: () => commit('stroke'),
    fill: () => commit('fill'),
    clip: () => {
      state.clipped = true
    },
    // 실제 캔버스처럼 선 굵기와 clip을 되돌린다.
    save: () => {
      saved.push({ lineWidth: state.lineWidth, clipped: state.clipped })
    },
    restore: () => {
      Object.assign(state, saved.pop())
    },
    drawImage: () => undefined,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, shapes }
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
  aiMark: 'AI',
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

const longWords = (n: number) => Array.from({ length: n }, (_, i) => `Word${i}`).join(' ')
/** 공백 없는 긴 이름. 글자 단위로 잘려 줄마다 폭 한도 바로 앞까지 찬다(좁은 채움 글자라 한도와의 차이가 1px 남짓). */
const LONG_RUN = FILL.repeat(1000)

/**
 * 간격 검사용 최악 조합: 예산 테스트의 조합(이름 2줄, 긴 궁합 이름)에 폭 한도까지 찬 계절 이름(1줄, 원 견본에 가장 가깝다)과 향 이름을 더한다.
 * 향 이름은 기본이 2줄 폭 한도까지(고리에 가장 가깝다)이고, 1줄을 주면 고리가 가장 위로 올라가 원 견본에 가장 가깝다.
 */
function crowdedView(base: ResultView, scentName = LONG_RUN): ResultView {
  return {
    ...base,
    name: longWords(14),
    color: { ...base.color, name: LONG_RUN },
    scent: { ...base.scent, name: scentName },
    match: { ...base.match, best: { ...base.match.best, name: longWords(12) }, opposite: { ...base.match.opposite, name: longWords(12) } },
  }
}

/** 모든 막대가 바깥 반지름까지 닿는 가장 큰 고리. 녹음 모양에 따라 고리 상자가 작아져 겹침을 놓치지 않게 한다. */
const fullRing = (view: ResultView): ResultView => ({ ...view, signature: new Array<number>(SIGNATURE_BINS).fill(1) })

/** 고리·원 견본은 글자와, 그리고 서로 이만큼 떨어져야 한다. 지금 배치가 일부러 둔 가장 좁은 간격(계절 이름–원 견본 24px)이다. */
const MIN_GAP = 24

/** 글자 상자. 가로는 정렬과 어림 폭, 세로는 기준선 위 1.0em·아래 0.25em(실제 글꼴 상자 약 0.98em·0.22em보다 넉넉하게, 028 설계). */
function textBox(c: TextCall): Box {
  const left = leftOf(c)
  return { left, top: c.y - c.size, right: left + c.width, bottom: c.y + c.size * 0.25 }
}

/** 두 상자 사이 거리. 겹치거나 맞닿으면 0. */
function gapBetween(a: Box, b: Box): number {
  const dx = Math.max(0, a.left - b.right, b.left - a.right)
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom)
  return Math.hypot(dx, dy)
}

/**
 * 고리(잘리지 않은 선 180개를 합친 상자)와 원 견본(잘리지 않은 원 5개)이 모든 글자와, 고리와 각 원 견본이 서로 MIN_GAP 이상 떨어지는지,
 * 그 밖의 도형(초상 테두리, 축 막대, 자리표시 초상 안의 고리)이 글자와 겹치지 않는지 보고 어긋난 것을 돌려준다.
 */
function spacingProblems(calls: TextCall[], shapes: ShapeCall[]): string[] {
  const bars = shapes.filter((s) => s.kind === 'line' && !s.clipped)
  const swatches = shapes.filter((s) => s.kind === 'circle' && !s.clipped)
  if (bars.length !== SIGNATURE_BINS || swatches.length !== 5) return [`ring bars ${bars.length}, swatches ${swatches.length}`]
  const ring: Box = {
    left: Math.min(...bars.map((s) => s.box.left)),
    top: Math.min(...bars.map((s) => s.box.top)),
    right: Math.max(...bars.map((s) => s.box.right)),
    bottom: Math.max(...bars.map((s) => s.box.bottom)),
  }
  const spaced: [string, Box][] = [['ring', ring], ...swatches.map((s, i): [string, Box] => [`swatch ${i + 1}`, s.box])]
  const others = shapes.filter((s) => !bars.includes(s) && !swatches.includes(s))
  const problems: string[] = []
  for (const call of calls) {
    const box = textBox(call)
    for (const [name, shape] of spaced) {
      const gap = gapBetween(shape, box)
      if (gap < MIN_GAP - 0.01) problems.push(`${name} – "${call.text}" ${gap.toFixed(1)}px`)
    }
    for (const shape of others) {
      if (gapBetween(shape.box, box) === 0) problems.push(`${shape.kind} ${shape.op} overlaps "${call.text}"`)
    }
  }
  swatches.forEach((s, i) => {
    const gap = gapBetween(ring, s.box)
    if (gap < MIN_GAP - 0.01) problems.push(`ring – swatch ${i + 1} ${gap.toFixed(1)}px`)
  })
  return problems
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

describe('drawCard 도형과 글자 간격 (028)', () => {
  it('가짜 컨텍스트는 경로의 상자·종류·clip 안 여부를 기록하고, restore로 선 굵기와 clip을 되돌린다', () => {
    const { ctx, shapes } = fakeContext()
    ctx.beginPath()
    ctx.arc(100, 200, 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(10, 10)
    ctx.lineTo(50, 30)
    ctx.stroke()
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(20, 0)
    ctx.arcTo(100, 0, 100, 50, 20)
    ctx.arcTo(100, 50, 0, 50, 20)
    ctx.arcTo(0, 50, 0, 0, 20)
    ctx.arcTo(0, 0, 100, 0, 20)
    ctx.closePath()
    ctx.clip()
    ctx.fill()
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(5, 5)
    ctx.lineTo(6, 6)
    ctx.stroke()
    ctx.restore()
    ctx.beginPath()
    ctx.moveTo(1, 1)
    ctx.lineTo(2, 2)
    ctx.stroke()
    expect(shapes).toEqual([
      { kind: 'circle', op: 'fill', clipped: false, box: { left: 70, top: 170, right: 130, bottom: 230 } },
      { kind: 'line', op: 'stroke', clipped: false, box: { left: 8, top: 8, right: 52, bottom: 32 } },
      { kind: 'rounded', op: 'fill', clipped: true, box: { left: 0, top: 0, right: 100, bottom: 50 } },
      { kind: 'line', op: 'stroke', clipped: true, box: { left: 4, top: 4, right: 7, bottom: 7 } },
      { kind: 'line', op: 'stroke', clipped: false, box: { left: -1, top: -1, right: 4, bottom: 4 } },
    ])
  })

  it.each(['ko', 'en'] as const)('모든 타입(%s)에서 고리·원 견본이 글자와, 그리고 서로 24px 이상 떨어지고 다른 도형도 글자와 겹치지 않는다', (locale) => {
    const labels = locale === 'ko' ? labelsKo : labelsEn
    for (const code of ALL_TYPE_CODES) {
      const view = fullRing(presentResult(profileFor(code), null, locale))
      const { ctx, calls, shapes } = fakeContext()
      drawCard(ctx, view, null, labels)
      expect(spacingProblems(calls, shapes), `${code} ${locale}`).toEqual([])
    }
  })

  it.each([
    ['향 이름 2줄 폭 한도까지', LONG_RUN, 2],
    ['향 이름 1줄, 고리가 원 견본에 가장 가깝다', 'Word0 Word1', 1],
  ] as const)('최악 조합(%s)에서도 고리·원 견본이 글자와, 그리고 서로 24px 이상 떨어진다', (_, scentName, scentLines) => {
    const view = fullRing(crowdedView(presentResult(profileFor('WFQV'), null, 'en'), scentName))
    const { ctx, calls, shapes } = fakeContext()
    drawCard(ctx, view, null, { ...labelsEn, caption: longWords(40) })
    // 한도가 실제로 찼는지: 이름(72px) 2줄, 계절 이름(48px) 말줄임 1줄, 향 이름(42px)은 의도한 줄 수
    expect(calls.filter((c) => c.size === 72)).toHaveLength(2)
    expect(calls.filter((c) => c.size === 48 && c.text.endsWith('…'))).toHaveLength(1)
    expect(calls.filter((c) => c.size === 42)).toHaveLength(scentLines)
    expect(spacingProblems(calls, shapes)).toEqual([])
  })
})

describe('생성 초상 AI 표시 (034)', () => {
  it('생성된 초상이 있으면 초상 오른쪽 위 안쪽에 "AI" 알약을 그리고, 자리표시 초상이거나 표시가 비면 그리지 않는다', () => {
    const view = presentResult(profileFor('WFQV'), null, 'ko')
    const portrait = { naturalWidth: 1024, naturalHeight: 1024 } as HTMLImageElement
    const left = (1080 - 420) / 2
    const top = 150
    const { ctx, calls, shapes } = fakeContext()
    drawCard(ctx, view, portrait, labelsKo)
    const marks = calls.filter((call) => call.text === 'AI')
    expect(marks).toHaveLength(1)
    const pill = shapes.find((shape) => shape.kind === 'rounded' && shape.op === 'fill' && shape.box.top === top + 24)
    expect(pill).toBeDefined()
    // 알약은 초상 사각형 안, 오른쪽 위 모서리 쪽이고 clip 밖에서 그린다(초상을 지나 잘리지 않는다).
    expect(pill!.box.right).toBe(left + 420 - 24)
    expect(pill!.box.left).toBeGreaterThan(left + 420 / 2)
    expect(pill!.box.bottom).toBeLessThan(top + 420 / 2)
    expect(pill!.clipped).toBe(false)
    // 글자는 알약 안 가운데.
    expect(marks[0]!.x).toBeCloseTo((pill!.box.left + pill!.box.right) / 2)
    expect(marks[0]!.y).toBeGreaterThan(pill!.box.top)
    expect(marks[0]!.y).toBeLessThan(pill!.box.bottom)

    const placeholder = fakeContext()
    drawCard(placeholder.ctx, view, null, labelsKo)
    expect(placeholder.calls.some((call) => call.text === 'AI')).toBe(false)
    const empty = fakeContext()
    drawCard(empty.ctx, view, portrait, { ...labelsKo, aiMark: '' })
    expect(empty.calls.some((call) => call.text === 'AI')).toBe(false)
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
