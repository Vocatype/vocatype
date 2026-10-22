import { mixHex } from './contrast'

export interface Bar {
  x1: number
  y1: number
  x2: number
  y2: number
}

export const SIGNATURE_BINS = 180

/** 이 백분위수의 값을 1로 맞춘다(상위 5%). 기침·파열음처럼 튀는 한 순간이 나머지 막대를 모두 누르지 않게(027). */
export const SIGNATURE_PERCENTILE = 0.95

/**
 * 포락선을 bins 개로 평균 내고 0..1로 정규화한다. 입력이 비면 0으로 채운다.
 * 95번째 백분위수를 1로 맞추고 그 위는 1로 자른 뒤, 제곱근으로 작은 값을 끌어올려 고리가 고르게 차게 한다.
 */
export function resampleEnvelope(values: readonly number[], bins: number = SIGNATURE_BINS): number[] {
  if (bins <= 0) return []
  if (values.length === 0) return new Array<number>(bins).fill(0)
  const out = new Array<number>(bins).fill(0)
  for (let i = 0; i < bins; i += 1) {
    const start = Math.floor((i * values.length) / bins)
    const end = Math.max(start + 1, Math.floor(((i + 1) * values.length) / bins))
    let sum = 0
    for (let j = start; j < end && j < values.length; j += 1) sum += values[j] ?? 0
    out[i] = sum / (Math.min(end, values.length) - start)
  }
  const sorted = [...out].sort((a, b) => a - b)
  // 소리가 있는 칸이 5%도 안 되면 백분위수가 0이므로 가장 큰 값을 기준으로 쓴다.
  const reference = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * SIGNATURE_PERCENTILE))] || (sorted[sorted.length - 1] ?? 0)
  return reference > 0 ? out.map((value) => Math.sqrt(Math.min(1, value / reference))) : out
}

/** 막대 색을 놓을 바탕. 어두운 바탕(저장 카드·다크 화면)은 밝히고, 밝은 바탕은 어둡게 해야 옅은 팔레트 색도 보인다. */
export type SignatureBackground = 'dark' | 'light'

const LIFT_ON_DARK = 0.18
const SHADE_ON_LIGHT = 0.25

/**
 * 막대마다의 퍼스널 컬러 톤(027). 팔레트 앞 4색을 시간 순서(12시에서 시계 방향)로 지나 첫 색으로 돌아온다.
 * 다섯째 색(계절마다 크림·화이트)은 바탕에 묻혀 쓰지 않는다. 팔레트가 비면 빈 배열.
 */
export function signatureColors(palette: readonly string[], count: number, background: SignatureBackground): string[] {
  const base = palette.slice(0, 4)
  if (base.length === 0 || count <= 0) return []
  const stops = [...base, base[0] as string].map((color) =>
    background === 'dark' ? mixHex(color, '#ffffff', LIFT_ON_DARK) : mixHex(color, '#000000', SHADE_ON_LIGHT),
  )
  return Array.from({ length: count }, (_, i) => {
    const position = (i / count) * (stops.length - 1)
    const k = Math.floor(position)
    return mixHex(stops[k] as string, stops[Math.min(k + 1, stops.length - 1)] as string, position - k)
  })
}

/**
 * 원 둘레를 따라 방사형 막대 좌표를 만든다. 12시 방향에서 시작해 시계 방향으로 돈다.
 * SVG(결과 화면)와 캔버스(저장 이미지)가 같은 함수를 써서 같은 모양이 나온다.
 */
export function signatureBars(values: readonly number[], cx: number, cy: number, innerR: number, outerR: number): Bar[] {
  const n = values.length
  const bars: Bar[] = []
  for (let i = 0; i < n; i += 1) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
    const v = Math.min(1, Math.max(0, values[i] ?? 0))
    const r2 = innerR + (outerR - innerR) * (0.08 + 0.92 * v)
    bars.push({
      x1: cx + innerR * Math.cos(angle),
      y1: cy + innerR * Math.sin(angle),
      x2: cx + r2 * Math.cos(angle),
      y2: cy + r2 * Math.sin(angle),
    })
  }
  return bars
}
