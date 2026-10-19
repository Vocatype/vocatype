export interface Bar {
  x1: number
  y1: number
  x2: number
  y2: number
}

export const SIGNATURE_BINS = 180

/** 포락선을 bins 개로 평균 내고 최대값이 1이 되게 정규화한다. 입력이 비면 0으로 채운다. */
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
  const peak = Math.max(...out)
  return peak > 0 ? out.map((value) => value / peak) : out
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
