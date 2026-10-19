/** 6자리(또는 3자리) hex를 RGB 0..255로. 잘못된 값이면 null. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.trim().replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) }
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) ?? { r: 128, g: 128, b: 128 }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/** 상대 휘도 0..1 (sRGB). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

/** 두 색의 평균 휘도가 밝으면 어두운 선, 아니면 흰 선. 자리표시 초상 위의 사운드 시그니처 색. */
export function signatureInkFor(hexA: string, hexB: string): string {
  const bright = (luminance(hexA) + luminance(hexB)) / 2 > 0.45
  return bright ? 'rgba(30, 24, 40, 0.8)' : 'rgba(255, 255, 255, 0.88)'
}
