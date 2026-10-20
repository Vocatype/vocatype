import type { ResultView } from '../profile/present'
import { hexToRgba, luminance, signatureInkFor } from '../signature/contrast'
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
  /** 통계 두 줄. 예: ['평균 음높이 142Hz', '분당 250음절'] */
  stats: readonly string[]
  /** 목소리 리딩의 공유용 캡션. 한 줄만 그리고, 빈 문자열이면 그리지 않는다. */
  caption: string
}

const FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
const BG = '#141319'
const FG = '#f4f1ec'
const MUTED = '#b5afa6'
const MARGIN = 72
const CONTENT_WIDTH = CARD_WIDTH - MARGIN * 2
/** 이 선 아래로는 본문을 그리지 않는다. 하단 문구 영역. */
const FOOTER_TOP = CARD_HEIGHT - 120

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
  drawSignature(ctx, view.signature, x + size / 2, y + size / 2, size * 0.22, size * 0.42, signatureInkFor(c1, c2))
}

/**
 * 결과 카드를 1080×1920 PNG로 그린다. 외부 리소스를 쓰지 않아 캔버스가 오염되지 않는다.
 * 세로 배치는 커서(y)로 누적하며, 이름 2줄·설명 3줄·캡션 1줄·향 이름 2줄로 줄 수를 제한해 하단 문구 영역(FOOTER_TOP) 위에서 끝나도록 설계했다.
 * 그래도 넘치면 예외를 던진다(테스트가 모든 타입·언어로 검사한다).
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

  // 배경
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  const glow = ctx.createRadialGradient(CARD_WIDTH / 2, 380, 60, CARD_WIDTH / 2, 380, 860)
  glow.addColorStop(0, hexToRgba(primary, 0.55))
  glow.addColorStop(0.55, hexToRgba(secondary, 0.18))
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CARD_WIDTH, 1000)

  // 상단
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = MUTED
  ctx.font = font(600, 28)
  ctx.textAlign = 'left'
  ctx.fillText(labels.serviceName, MARGIN, 104)
  ctx.textAlign = 'right'
  ctx.fillText(labels.date, CARD_WIDTH - MARGIN, 104)

  // 초상. 009에서 캡션 한 줄(44px)을 넣으며 400 → 380으로 줄여 세로 예산을 회수했다.
  const portraitSize = 380
  const portraitX = (CARD_WIDTH - portraitSize) / 2
  const portraitY = 150
  ctx.save()
  roundedRect(ctx, portraitX, portraitY, portraitSize, portraitSize, 44)
  ctx.clip()
  if (portrait) {
    const scale = Math.max(portraitSize / portrait.naturalWidth, portraitSize / portrait.naturalHeight)
    const w = portrait.naturalWidth * scale
    const h = portrait.naturalHeight * scale
    ctx.drawImage(portrait, portraitX + (portraitSize - w) / 2, portraitY + (portraitSize - h) / 2, w, h)
  } else {
    drawPortraitPlaceholder(ctx, view, portraitX, portraitY, portraitSize)
  }
  ctx.restore()
  ctx.save()
  roundedRect(ctx, portraitX, portraitY, portraitSize, portraitSize, 44)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()

  // 타입 코드·이름·설명
  let y = portraitY + portraitSize + 64
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = font(700, 30)
  ctx.fillText(view.code.split('').join('  '), CARD_WIDTH / 2, y)
  y += 66
  ctx.fillStyle = FG
  ctx.font = font(800, 60)
  for (const line of clampLines(wrapText(view.name, CONTENT_WIDTH, measure), 2, CONTENT_WIDTH, measure)) {
    ctx.fillText(line, CARD_WIDTH / 2, y)
    y += 66
  }
  y -= 10
  ctx.font = font(400, 28)
  for (const line of clampLines(wrapText(view.description, CONTENT_WIDTH - 60, measure), 3, CONTENT_WIDTH - 60, measure)) {
    ctx.fillText(line, CARD_WIDTH / 2, y)
    y += 36
  }

  // 리딩 캡션. 한 줄만(한글 약 33자·영문 약 60자), 넘치면 말줄임. 없으면 공간도 쓰지 않는다.
  // 한글 글꼴에는 이탤릭이 없어 합성 기울임이 되므로 굵기로만 구분한다.
  if (labels.caption) {
    y += 8
    ctx.font = font(600, 26)
    for (const line of clampLines(wrapText(labels.caption, CONTENT_WIDTH - 60, measure), 1, CONTENT_WIDTH - 60, measure)) {
      ctx.fillText(line, CARD_WIDTH / 2, y)
      y += 36
    }
  }

  // 축 강도: 한 줄에 네 개의 작은 막대 (글자 + 라벨, 퍼센트, 막대). 신호가 부족하면 기본값이라 그리지 않는다.
  if (view.quality === 'ok') {
    y += 10
    const barGap = 24
    const barWidth = (CONTENT_WIDTH - barGap * 3) / 4
    // 어두운 대표색(겨울 쿨 등)은 어두운 바탕에서 보이지 않으므로 밝은 글자색으로 채운다.
    const fill = luminance(primary) < 0.3 ? FG : primary
    for (let i = 0; i < view.axes.length; i += 1) {
      const axis = view.axes[i]
      if (!axis) continue
      const x = MARGIN + i * (barWidth + barGap)
      const percentText = `${axis.percent}%`
      ctx.font = font(600, 22)
      const labelWidth = barWidth - measure(percentText) - 12
      ctx.textAlign = 'left'
      ctx.fillStyle = FG
      ctx.font = font(700, 22)
      // 글자(W/C 등)는 항상 남기고 라벨만 폭에 맞춰 말줄임한다.
      const prefix = `${axis.letter} `
      const textWidth = labelWidth - measure(prefix)
      const [label] = clampLines(wrapText(axis.label, textWidth, measure), 1, textWidth, measure)
      ctx.fillText(prefix + (label ?? ''), x, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = MUTED
      ctx.font = font(600, 22)
      ctx.fillText(percentText, x + barWidth, y)
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      roundedRect(ctx, x, y + 12, barWidth, 10, 5)
      ctx.fill()
      ctx.fillStyle = fill
      roundedRect(ctx, x, y + 12, barWidth * (axis.percent / 100), 10, 5)
      ctx.fill()
    }
    ctx.textAlign = 'center'
    y += 46
  }

  const section = (title: string, top: number) => {
    ctx.textAlign = 'left'
    ctx.fillStyle = MUTED
    ctx.font = font(700, 22)
    ctx.fillText(title.toUpperCase(), MARGIN, top)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(MARGIN, top + 14)
    ctx.lineTo(CARD_WIDTH - MARGIN, top + 14)
    ctx.stroke()
  }

  // 퍼스널 컬러
  y += 40
  section(labels.color, y)
  y += 54
  ctx.fillStyle = FG
  ctx.font = font(700, 34)
  ctx.fillText(view.color.name, MARGIN, y)
  y += 26
  const swatch = 150
  const swatchGap = (CONTENT_WIDTH - swatch * 5) / 4
  for (let i = 0; i < 5; i += 1) {
    const sx = MARGIN + i * (swatch + swatchGap)
    ctx.fillStyle = view.color.palette[i] ?? '#888'
    roundedRect(ctx, sx, y, swatch, 68, 18)
    ctx.fill()
    ctx.fillStyle = MUTED
    ctx.font = font(500, 20)
    ctx.textAlign = 'center'
    ctx.fillText((view.color.palette[i] ?? '').toUpperCase(), sx + swatch / 2, y + 90)
    ctx.textAlign = 'left'
  }
  y += 98

  // 향 (왼쪽) + 사운드 시그니처 (오른쪽)
  y += 40
  section(labels.scent, y)
  const columnWidth = 560
  let sy = y + 56
  ctx.fillStyle = FG
  ctx.font = font(700, 32)
  for (const line of clampLines(wrapText(view.scent.name, columnWidth, measure), 2, columnWidth, measure)) {
    ctx.fillText(line, MARGIN, sy)
    sy += 40
  }
  sy += 4
  ctx.font = font(400, 25)
  const noteLines = [
    `${labels.top} · ${view.scent.top.join(', ')}`,
    `${labels.middle} · ${view.scent.middle.join(', ')}`,
    `${labels.base} · ${view.scent.base.join(', ')}`,
  ]
  for (const note of noteLines) {
    for (const line of clampLines(wrapText(note, columnWidth, measure), 1, columnWidth, measure)) {
      ctx.fillStyle = FG
      ctx.fillText(line, MARGIN, sy)
      sy += 34
    }
  }

  // 서명 반지름 110 → 100, 아래 여백 48 → 40: 캡션 한 줄 예산 회수(009).
  const sigR = 100
  const sigCx = CARD_WIDTH - MARGIN - 150
  const sigCy = y + 56 + sigR
  drawSignature(ctx, view.signature, sigCx, sigCy, sigR * 0.45, sigR, primary)
  let statY = sigCy + sigR + 38
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = font(600, 21)
  ctx.fillText(labels.signature, sigCx, statY)
  ctx.font = font(400, 21)
  for (const stat of labels.stats) {
    statY += 28
    for (const line of clampLines(wrapText(stat, 300, measure), 1, 300, measure)) ctx.fillText(line, sigCx, statY)
  }
  ctx.textAlign = 'left'
  y = Math.max(sy, statY) + 40

  // 궁합
  section(labels.match, y)
  y += 44
  const halfWidth = CONTENT_WIDTH / 2 - 24
  const rightX = CARD_WIDTH / 2 + 24
  ctx.fillStyle = MUTED
  ctx.font = font(600, 22)
  ctx.fillText(labels.best, MARGIN, y)
  ctx.fillText(labels.opposite, rightX, y)
  y += 36
  ctx.fillStyle = FG
  ctx.font = font(700, 30)
  const bestLines = clampLines(wrapText(view.match.best.name, halfWidth, measure), 2, halfWidth, measure)
  const oppositeLines = clampLines(wrapText(view.match.opposite.name, halfWidth, measure), 2, halfWidth, measure)
  const rows = Math.max(bestLines.length, oppositeLines.length)
  for (let i = 0; i < rows; i += 1) {
    const left = bestLines[i]
    const right = oppositeLines[i]
    if (left) ctx.fillText(left, MARGIN, y + i * 36)
    if (right) ctx.fillText(right, rightX, y + i * 36)
  }
  y += rows * 36
  ctx.fillStyle = MUTED
  ctx.font = font(500, 22)
  ctx.fillText(view.match.best.code.split('').join(' '), MARGIN, y)
  ctx.fillText(view.match.opposite.code.split('').join(' '), rightX, y)

  if (y > FOOTER_TOP) throw new Error(`card layout overflow: ${Math.round(y)} > ${FOOTER_TOP}`)

  // 하단
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = font(500, 22)
  if (labels.readOf) ctx.fillText(labels.readOf, CARD_WIDTH / 2, CARD_HEIGHT - 86)
  ctx.font = font(400, 20)
  ctx.fillText(`${labels.serviceName} · ${labels.tagline}`, CARD_WIDTH / 2, CARD_HEIGHT - 52)
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
