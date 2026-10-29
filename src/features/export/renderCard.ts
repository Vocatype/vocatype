import type { ResultView } from '../profile/present'
import { hexToRgba, signatureInkFor } from '../signature/contrast'
import { signatureBars, signatureColors } from '../signature/signature'
import { wrapText } from './wrapText'

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1920

/** 화면에서 t()로 만든 문구. 캔버스는 i18n 훅을 쓸 수 없어 값으로 받는다. */
export interface CardLabels {
  serviceName: string
  tagline: string
  /** 섹션 제목: 퍼스널 컬러 */
  color: string
  /** 섹션 제목: 시그니처 향 */
  scent: string
  /** 궁합 줄 라벨: 최고의 짝 */
  best: string
  /** 궁합 줄 라벨: 정반대 */
  opposite: string
  /** 예: 『서시』 낭독. 없으면 빈 문자열 */
  readOf: string
  date: string
  /** 목소리 해설의 공유용 캡션. 한 줄만 그리고, 빈 문자열이면 그리지 않는다. */
  caption: string
  /** 생성된 초상 오른쪽 위에 붙이는 작은 표시(예: "AI"). 자리표시 초상이거나 빈 문자열이면 그리지 않는다(034). */
  aiMark: string
}

/*
 * 027 배치: 기본 테마(어두운 바탕·흰 글자)는 모든 타입이 같고, 퍼스널 컬러 톤은 아우라·원형 파형·색 견본에만 넣는다.
 * 대화에서 정한 시안 A(가을 웜, 1080×1920 렌더)를 기준으로 했다.
 */
const FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
const BG = '#141319'
const FG = '#f4f1ec'
/** 본문 보조(캡션, 축·궁합 이름). */
const SOFT = '#d9d4cc'
/** 라벨·머리글·하단. */
const MUTED = '#9f9a92'
const MARGIN = 72
const CONTENT_WIDTH = CARD_WIDTH - MARGIN * 2
/** 이 선 아래로는 본문을 그리지 않는다. 하단 문구 영역. */
export const FOOTER_TOP = CARD_HEIGHT - 120
/** 줄 수 제한이 모두 꽉 찬 최악 조합도 FOOTER_TOP에서 이만큼은 위에서 끝나야 한다(테스트가 단언). 다음 요소를 넣을 때 쓸 수 있는 예산. */
export const BUDGET_RESERVE = 60

/** 초상: 둥근 정사각형. */
const PORTRAIT_SIZE = 420
const PORTRAIT_Y = 150
/** 이름 줄 간격(72px 굵게). */
const NAME_LINE = 84
/** 축: 2×2. 두 칸 사이 간격과 막대 폭. */
const AXIS_COLUMN_GAP = 70
const AXIS_BAR_WIDTH = (CONTENT_WIDTH - AXIS_COLUMN_GAP) / 2
const AXIS_ROW = 96
/** 퍼스널 컬러 원 5개. */
const SWATCH_R = 30
const SWATCH_STEP = 84
/** 원형 파형. 안쪽 반지름 비율은 시안(14/38)을 따른다. 막대 180개가 바깥 둘레에서 약 3.8px 간격이라 굵기는 2.6으로 둬 서로 붙지 않게 한다. */
const RING_R = 110
const RING_INNER = 0.37
/** 향 이름 줄 간격(42px 굵게). */
const SCENT_LINE = 54
/** 궁합 두 줄 간격. */
const MATCH_ROW = 60

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FONT}`
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * 줄 수를 제한하고 넘치는 마지막 줄은 말줄임표로 끝낸다.
 * measure와 maxWidth를 주면 말줄임표를 붙인 줄이 폭 안에 들도록 글자를 더 줄인다.
 */
export function clampLines(lines: readonly string[], max: number, maxWidth?: number, measure?: (s: string) => number): string[] {
  if (lines.length <= max) return [...lines]
  const kept = lines.slice(0, max)
  let last = (kept[max - 1] ?? '').replace(/[\s,.;:·]+$/, '')
  last = last.slice(0, Math.max(0, last.length - 1))
  if (measure && maxWidth !== undefined) {
    while (last.length > 0 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).replace(/[\s,.;:·]+$/, '')
  }
  kept[max - 1] = `${last}…`
  return kept
}

/** 원형 파형. strokeFor(i)로 막대마다 색을 정한다. innerCircle이면 안쪽 원을 옅게 그린다(자리표시 초상용). */
function drawSignature(
  ctx: CanvasRenderingContext2D,
  values: readonly number[],
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  strokeFor: (index: number) => string,
  options: { lineWidth: number; innerCircle?: string },
) {
  ctx.save()
  ctx.lineWidth = options.lineWidth
  ctx.lineCap = 'round'
  signatureBars(values, cx, cy, innerR, outerR).forEach((bar, index) => {
    ctx.strokeStyle = strokeFor(index)
    ctx.beginPath()
    ctx.moveTo(bar.x1, bar.y1)
    ctx.lineTo(bar.x2, bar.y2)
    ctx.stroke()
  })
  if (options.innerCircle) {
    ctx.strokeStyle = options.innerCircle
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, innerR - 10, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/** 생성 초상이 없을 때: 팔레트 그라데이션 위에 한 가지 잉크색의 원형 파형(그라데이션 위에서 읽히도록). */
function drawPortraitPlaceholder(ctx: CanvasRenderingContext2D, view: ResultView, x: number, y: number, size: number) {
  const [c1 = '#6d5dfc', c2 = '#ff7a59'] = view.color.palette
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size)
  gradient.addColorStop(0, c1)
  gradient.addColorStop(1, c2)
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, size, size)
  const ink = signatureInkFor(c1, c2)
  drawSignature(ctx, view.signature, x + size / 2, y + size / 2, size * 0.22, size * 0.42, () => ink, { lineWidth: 3, innerCircle: ink })
}

/** 생성 초상 위 표시의 안쪽 여백·높이·글자 크기. 초상 모서리 둥글기(46) 안쪽에 들도록 둔다. */
const AI_MARK_INSET = 24
const AI_MARK_HEIGHT = 44
const AI_MARK_FONT = 26

/** 오른쪽 위 모서리(right, top) 기준으로 어두운 반투명 알약과 흰 글자를 그린다. 사진 위라 어떤 색 위에서도 읽힌다. */
function drawAiMark(ctx: CanvasRenderingContext2D, text: string, right: number, top: number) {
  ctx.save()
  ctx.font = font(700, AI_MARK_FONT)
  const width = ctx.measureText(text).width + 28
  ctx.fillStyle = 'rgba(15, 14, 18, 0.62)'
  roundedRect(ctx, right - width, top, width, AI_MARK_HEIGHT, AI_MARK_HEIGHT / 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText(text, right - width / 2, top + AI_MARK_HEIGHT / 2 + AI_MARK_FONT * 0.36)
  ctx.restore()
}

/** 한 줄로 맞추고 넘치면 말줄임. */
function oneLine(text: string, width: number, measure: (s: string) => number): string {
  return clampLines(wrapText(text, width, measure), 1, width, measure)[0] ?? ''
}

/**
 * 결과 카드를 1080×1920 PNG로 그린다. 외부 리소스를 쓰지 않아 캔버스가 오염되지 않는다.
 * 세로 배치는 커서(y)로 누적하며, 이름 2줄·캡션 1줄·향 이름 2줄·궁합 이름 1줄로 줄 수를 제한해 하단 문구 영역(FOOTER_TOP) 위에서 끝나도록 설계했다.
 * 모든 제한이 꽉 찬 최악 조합도 FOOTER_TOP − BUDGET_RESERVE 위에서 끝난다(테스트가 단언). 그래도 넘치면 예외를 던진다(테스트가 모든 타입·언어로 검사한다).
 */
export async function renderCard(view: ResultView, portrait: HTMLImageElement | null, labels: CardLabels): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  drawCard(ctx, view, portrait, labels)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

/** 그리기 본체. 테스트에서 가짜 컨텍스트로 좌표를 검사할 수 있게 분리했다. */
export function drawCard(ctx: CanvasRenderingContext2D, view: ResultView, portrait: HTMLImageElement | null, labels: CardLabels): void {
  const [primary = '#6d5dfc', secondary = '#ff7a59'] = view.color.palette
  const measure = (s: string) => ctx.measureText(s).width

  // 바탕과 아우라: 팔레트 1·2번째 색이 초상 뒤에서 부드럽게 번진다(퍼스널 컬러 톤 1).
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  const aura = ctx.createRadialGradient(CARD_WIDTH / 2, 390, 0, CARD_WIDTH / 2, 390, 600)
  aura.addColorStop(0, hexToRgba(primary, 0.42))
  aura.addColorStop(0.55, hexToRgba(primary, 0.14))
  aura.addColorStop(1, hexToRgba(primary, 0))
  ctx.fillStyle = aura
  ctx.fillRect(0, 0, CARD_WIDTH, 1000)
  const aura2 = ctx.createRadialGradient(CARD_WIDTH / 2 + 80, 440, 0, CARD_WIDTH / 2 + 80, 440, 380)
  aura2.addColorStop(0, hexToRgba(secondary, 0.3))
  aura2.addColorStop(1, hexToRgba(secondary, 0))
  ctx.fillStyle = aura2
  ctx.fillRect(0, 0, CARD_WIDTH, 1000)

  // 상단
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = MUTED
  ctx.font = font(500, 34)
  ctx.textAlign = 'left'
  ctx.fillText(labels.serviceName, MARGIN, 96)
  ctx.textAlign = 'right'
  ctx.fillText(labels.date, CARD_WIDTH - MARGIN, 96)

  // 초상
  const portraitX = (CARD_WIDTH - PORTRAIT_SIZE) / 2
  ctx.save()
  roundedRect(ctx, portraitX, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE, 46)
  ctx.clip()
  if (portrait) {
    const scale = Math.max(PORTRAIT_SIZE / portrait.naturalWidth, PORTRAIT_SIZE / portrait.naturalHeight)
    const w = portrait.naturalWidth * scale
    const h = portrait.naturalHeight * scale
    ctx.drawImage(portrait, portraitX + (PORTRAIT_SIZE - w) / 2, PORTRAIT_Y + (PORTRAIT_SIZE - h) / 2, w, h)
  } else {
    drawPortraitPlaceholder(ctx, view, portraitX, PORTRAIT_Y, PORTRAIT_SIZE)
  }
  ctx.restore()
  ctx.save()
  roundedRect(ctx, portraitX, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE, 46)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()
  if (portrait && labels.aiMark) drawAiMark(ctx, labels.aiMark, portraitX + PORTRAIT_SIZE - AI_MARK_INSET, PORTRAIT_Y + AI_MARK_INSET)

  // 타입 코드·이름(최대 2줄)·해설 캡션(1줄, 없으면 공간도 쓰지 않음). 타입 설명 문단은 저장 카드에 넣지 않는다(결과 화면에 있다).
  let y = PORTRAIT_Y + PORTRAIT_SIZE + 90
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = font(600, 36)
  ctx.fillText(view.code.split('').join('  '), CARD_WIDTH / 2, y)
  y += 88
  ctx.fillStyle = FG
  ctx.font = font(700, 72)
  const nameLines = clampLines(wrapText(view.name, CONTENT_WIDTH, measure), 2, CONTENT_WIDTH, measure)
  nameLines.forEach((line, i) => ctx.fillText(line, CARD_WIDTH / 2, y + i * NAME_LINE))
  y += (nameLines.length - 1) * NAME_LINE
  if (labels.caption) {
    y += 70
    ctx.fillStyle = SOFT
    ctx.font = font(400, 40)
    ctx.fillText(oneLine(labels.caption, CONTENT_WIDTH - 40, measure), CARD_WIDTH / 2, y)
  }

  // 축 강도: 2×2, "글자 라벨"과 흰 막대(퍼센트 표기 없음). 신호가 부족하면 기본값이라 그리지 않는다.
  ctx.textAlign = 'left'
  if (view.quality === 'ok') {
    const firstRow = y + 110
    view.axes.slice(0, 4).forEach((axis, i) => {
      const x = MARGIN + (i % 2) * (AXIS_BAR_WIDTH + AXIS_COLUMN_GAP)
      const rowY = firstRow + Math.floor(i / 2) * AXIS_ROW
      ctx.fillStyle = SOFT
      ctx.font = font(400, 36)
      // 글자(W/C 등)는 항상 남기고 라벨만 폭에 맞춰 말줄임한다.
      const prefix = `${axis.letter} `
      ctx.fillText(prefix + oneLine(axis.label, AXIS_BAR_WIDTH - measure(prefix), measure), x, rowY)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      roundedRect(ctx, x, rowY + 22, AXIS_BAR_WIDTH, 10, 5)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      roundedRect(ctx, x, rowY + 22, AXIS_BAR_WIDTH * (axis.percent / 100), 10, 5)
      ctx.fill()
    })
    // 커서를 둘째 줄 막대 아랫변에 둔다.
    y = firstRow + AXIS_ROW + 32
  }

  // 퍼스널 컬러: 제목, 계절 이름(왼쪽), 원 5개(오른쪽)
  y += 110
  ctx.fillStyle = MUTED
  ctx.font = font(500, 34)
  ctx.fillText(labels.color, MARGIN, y)
  y += 62
  const swatchLeft = CARD_WIDTH - MARGIN - SWATCH_R - SWATCH_STEP * 4 - SWATCH_R
  ctx.fillStyle = FG
  ctx.font = font(700, 48)
  ctx.fillText(oneLine(view.color.name, swatchLeft - 24 - MARGIN, measure), MARGIN, y)
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = view.color.palette[i] ?? '#888888'
    ctx.beginPath()
    ctx.arc(swatchLeft + SWATCH_R + i * SWATCH_STEP, y - 16, SWATCH_R, 0, Math.PI * 2)
    ctx.fill()
  }

  // 향(왼쪽, 이름 최대 2줄) + 원형 파형(오른쪽, 퍼스널 컬러 톤 2). 파형은 향 블록 가운데 높이에 둔다.
  const ringCx = CARD_WIDTH - MARGIN - RING_R
  const ringLeft = ringCx - RING_R
  const scentWidth = ringLeft - 30 - MARGIN
  // 원형 파형 윗점이 퍼스널 컬러 원과 약 30px 떨어지도록 둔다(1차 리뷰 #4).
  y += 134
  const scentLabelY = y
  ctx.fillStyle = MUTED
  ctx.font = font(500, 34)
  ctx.fillText(labels.scent, MARGIN, y)
  y += 60
  ctx.fillStyle = FG
  ctx.font = font(700, 42)
  const scentLines = clampLines(wrapText(view.scent.name, scentWidth, measure), 2, scentWidth, measure)
  scentLines.forEach((line, i) => ctx.fillText(line, MARGIN, y + i * SCENT_LINE))
  y += (scentLines.length - 1) * SCENT_LINE
  const ringCy = (scentLabelY - 26 + y + 8) / 2
  const colors = signatureColors(view.color.palette, view.signature.length, 'dark')
  drawSignature(ctx, view.signature, ringCx, ringCy, RING_R * RING_INNER, RING_R, (i) => colors[i] ?? FG, { lineWidth: 2.6 })

  // 궁합: "최고의 짝 / 정반대" 두 줄. 파형 아래에서 시작해 가로 폭을 다 쓴다. 이름은 두 라벨 중 넓은 쪽 뒤에서 시작한다.
  y = Math.max(y + 100, ringCy + RING_R + 64)
  ctx.font = font(500, 34)
  const nameX = MARGIN + Math.max(measure(labels.best), measure(labels.opposite)) + 28
  const matchWidth = CARD_WIDTH - MARGIN - nameX
  const rows: [string, string][] = [
    [labels.best, view.match.best.name],
    [labels.opposite, view.match.opposite.name],
  ]
  rows.forEach(([label, name], i) => {
    const rowY = y + i * MATCH_ROW
    ctx.fillStyle = MUTED
    ctx.font = font(500, 34)
    ctx.fillText(label, MARGIN, rowY)
    ctx.fillStyle = SOFT
    ctx.font = font(400, 36)
    ctx.fillText(oneLine(name, matchWidth, measure), nameX, rowY)
  })
  y += MATCH_ROW

  if (y > FOOTER_TOP) throw new Error(`card layout overflow: ${Math.round(y)} > ${FOOTER_TOP}`)

  // 하단: 한 줄. 낭독한 글이 없으면 태그라인. 영어 시 제목이 길어 30px로 둔다.
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = font(400, 30)
  const footer = labels.readOf ? `${labels.readOf} · ${labels.serviceName}` : `${labels.serviceName} · ${labels.tagline}`
  ctx.fillText(oneLine(footer, CONTENT_WIDTH, measure), CARD_WIDTH / 2, CARD_HEIGHT - 62)
}

/** 데이터 URL 등을 이미지 요소로 불러온다. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image load failed'))
    image.src = src
  })
}
