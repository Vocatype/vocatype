import type { ResultView } from '../profile/present'
import { signatureBars } from '../signature/signature'
import { wrapText } from './wrapText'

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1920

/** 화면에서 t()로 만든 문구. 캔버스는 i18n 훅을 쓸 수 없어 값으로 받는다. */
export interface CardLabels {
  serviceName: string
  tagline: string
  color: string
  scent: string
  signature: string
  match: string
  best: string
  opposite: string
  top: string
  middle: string
  base: string
  /** 예: 『서시』 낭독 */
  readOf: string
  date: string
  stats: string
}

const FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
const BG = '#141319'
const FG = '#f4f1ec'
const MUTED = '#b5afa6'
const MARGIN = 72

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

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawSignature(ctx: CanvasRenderingContext2D, values: readonly number[], cx: number, cy: number, innerR: number, outerR: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (const bar of signatureBars(values, cx, cy, innerR, outerR)) {
    ctx.beginPath()
    ctx.moveTo(bar.x1, bar.y1)
    ctx.lineTo(bar.x2, bar.y2)
    ctx.stroke()
  }
  ctx.globalAlpha = 0.5
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, innerR - 10, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawPortraitPlaceholder(ctx: CanvasRenderingContext2D, view: ResultView, x: number, y: number, size: number) {
  const [c1 = '#6d5dfc', c2 = '#ff7a59'] = view.color.palette
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size)
  gradient.addColorStop(0, c1)
  gradient.addColorStop(1, c2)
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, size, size)
  drawSignature(ctx, view.signature, x + size / 2, y + size / 2, size * 0.22, size * 0.42, 'rgba(255, 255, 255, 0.85)')
}

/** 결과 카드를 1080×1920 PNG로 그린다. 외부 리소스를 쓰지 않아 캔버스가 오염되지 않는다. */
export async function renderCard(view: ResultView, portrait: HTMLImageElement | null, labels: CardLabels): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  const [primary = '#6d5dfc', secondary = '#ff7a59'] = view.color.palette
  const contentWidth = CARD_WIDTH - MARGIN * 2
  const measure = (s: string) => ctx.measureText(s).width

  // 배경
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  const glow = ctx.createRadialGradient(CARD_WIDTH / 2, 420, 60, CARD_WIDTH / 2, 420, 900)
  glow.addColorStop(0, hexToRgba(primary, 0.55))
  glow.addColorStop(0.55, hexToRgba(secondary, 0.18))
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CARD_WIDTH, 1100)

  // 상단
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = MUTED
  ctx.font = font(600, 28)
  ctx.textAlign = 'left'
  ctx.fillText(labels.serviceName, MARGIN, 104)
  ctx.textAlign = 'right'
  ctx.fillText(labels.date, CARD_WIDTH - MARGIN, 104)

  // 초상
  const portraitSize = 520
  const portraitX = (CARD_WIDTH - portraitSize) / 2
  const portraitY = 150
  ctx.save()
  roundedRect(ctx, portraitX, portraitY, portraitSize, portraitSize, 48)
  ctx.clip()
  if (portrait) {
    // cover 방식으로 꽉 채운다
    const scale = Math.max(portraitSize / portrait.naturalWidth, portraitSize / portrait.naturalHeight)
    const w = portrait.naturalWidth * scale
    const h = portrait.naturalHeight * scale
    ctx.drawImage(portrait, portraitX + (portraitSize - w) / 2, portraitY + (portraitSize - h) / 2, w, h)
  } else {
    drawPortraitPlaceholder(ctx, view, portraitX, portraitY, portraitSize)
  }
  ctx.restore()
  ctx.save()
  roundedRect(ctx, portraitX, portraitY, portraitSize, portraitSize, 48)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()

  // 타입
  let y = portraitY + portraitSize + 84
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = font(700, 32)
  ctx.fillText(view.code.split('').join('  '), CARD_WIDTH / 2, y)
  y += 76
  ctx.fillStyle = FG
  ctx.font = font(800, 66)
  for (const line of wrapText(view.name, contentWidth, measure)) {
    ctx.fillText(line, CARD_WIDTH / 2, y)
    y += 76
  }
  y += 4
  ctx.fillStyle = FG
  ctx.font = font(400, 30)
  for (const line of wrapText(view.description, contentWidth - 80, measure)) {
    ctx.fillText(line, CARD_WIDTH / 2, y)
    y += 44
  }

  // 축 칩
  y += 26
  ctx.font = font(600, 26)
  const chipPad = 22
  const chipGap = 14
  const chipWidths = view.axisLabels.map((label) => measure(label) + chipPad * 2)
  const chipsWidth = chipWidths.reduce((sum, w) => sum + w, 0) + chipGap * (chipWidths.length - 1)
  let chipX = (CARD_WIDTH - chipsWidth) / 2
  for (let i = 0; i < view.axisLabels.length; i += 1) {
    const w = chipWidths[i] ?? 0
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
    roundedRect(ctx, chipX, y - 30, w, 46, 23)
    ctx.fill()
    ctx.fillStyle = FG
    ctx.fillText(view.axisLabels[i] ?? '', chipX + w / 2, y + 2)
    chipX += w + chipGap
  }

  // 섹션 제목 헬퍼
  const section = (title: string, top: number) => {
    ctx.textAlign = 'left'
    ctx.fillStyle = MUTED
    ctx.font = font(700, 24)
    ctx.fillText(title.toUpperCase(), MARGIN, top)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(MARGIN, top + 16)
    ctx.lineTo(CARD_WIDTH - MARGIN, top + 16)
    ctx.stroke()
  }

  // 퍼스널 컬러
  y += 96
  section(labels.color, y)
  y += 64
  ctx.fillStyle = FG
  ctx.font = font(700, 38)
  ctx.fillText(view.color.name, MARGIN, y)
  y += 34
  const swatch = 150
  const swatchGap = (contentWidth - swatch * 5) / 4
  for (let i = 0; i < 5; i += 1) {
    const sx = MARGIN + i * (swatch + swatchGap)
    ctx.fillStyle = view.color.palette[i] ?? '#888'
    roundedRect(ctx, sx, y, swatch, 86, 20)
    ctx.fill()
    ctx.fillStyle = MUTED
    ctx.font = font(500, 22)
    ctx.textAlign = 'center'
    ctx.fillText((view.color.palette[i] ?? '').toUpperCase(), sx + swatch / 2, y + 118)
    ctx.textAlign = 'left'
  }
  y += 150

  // 향 (왼쪽) + 사운드 시그니처 (오른쪽)
  y += 48
  section(labels.scent, y)
  const scentTop = y + 64
  ctx.fillStyle = FG
  ctx.font = font(700, 34)
  let sy = scentTop
  for (const line of wrapText(view.scent.name, 600, measure)) {
    ctx.fillText(line, MARGIN, sy)
    sy += 42
  }
  sy += 10
  ctx.font = font(400, 26)
  const noteLines = [
    `${labels.top} · ${view.scent.top.join(', ')}`,
    `${labels.middle} · ${view.scent.middle.join(', ')}`,
    `${labels.base} · ${view.scent.base.join(', ')}`,
  ]
  for (const line of noteLines) {
    ctx.fillStyle = FG
    ctx.fillText(line, MARGIN, sy)
    sy += 38
  }
  ctx.fillStyle = MUTED
  ctx.font = font(400, 24)
  for (const line of wrapText(view.scent.mood, 600, measure)) {
    ctx.fillText(line, MARGIN, sy)
    sy += 34
  }

  const sigCx = CARD_WIDTH - MARGIN - 150
  const sigCy = scentTop + 110
  drawSignature(ctx, view.signature, sigCx, sigCy, 62, 140, primary)
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = font(600, 22)
  ctx.fillText(labels.signature, sigCx, sigCy + 182)
  ctx.font = font(400, 22)
  ctx.fillText(labels.stats, sigCx, sigCy + 214)
  ctx.textAlign = 'left'
  y = Math.max(sy, sigCy + 230) + 40

  // 궁합
  section(labels.match, y)
  y += 64
  ctx.fillStyle = MUTED
  ctx.font = font(600, 24)
  ctx.fillText(labels.best, MARGIN, y)
  ctx.fillText(labels.opposite, CARD_WIDTH / 2 + 20, y)
  y += 44
  ctx.fillStyle = FG
  ctx.font = font(700, 32)
  for (const line of wrapText(view.match.best.name, contentWidth / 2 - 40, measure)) {
    ctx.fillText(line, MARGIN, y)
    y += 40
  }
  let oy = y - 40 * wrapText(view.match.best.name, contentWidth / 2 - 40, measure).length
  for (const line of wrapText(view.match.opposite.name, contentWidth / 2 - 40, measure)) {
    ctx.fillText(line, CARD_WIDTH / 2 + 20, oy)
    oy += 40
  }
  y = Math.max(y, oy) + 2
  ctx.fillStyle = MUTED
  ctx.font = font(500, 24)
  ctx.fillText(view.match.best.code, MARGIN, y)
  ctx.fillText(view.match.opposite.code, CARD_WIDTH / 2 + 20, y)

  // 하단
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = font(500, 24)
  ctx.fillText(labels.readOf, CARD_WIDTH / 2, CARD_HEIGHT - 110)
  ctx.font = font(400, 22)
  ctx.fillText(`${labels.serviceName} · ${labels.tagline}`, CARD_WIDTH / 2, CARD_HEIGHT - 72)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
  })
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
