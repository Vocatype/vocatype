/** 6자리(또는 3자리) hex를 RGB 0..255로. 잘못된 값이면 null. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.trim().replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) }
}

/** 두 색을 t(0..1) 비율로 섞은 6자리 hex. 잘못된 값은 회색으로 본다. */
export function mixHex(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA) ?? { r: 128, g: 128, b: 128 }
  const b = hexToRgb(hexB) ?? { r: 128, g: 128, b: 128 }
  const k = Math.min(1, Math.max(0, t))
  const channel = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0')
  return `#${channel(a.r, b.r)}${channel(a.g, b.g)}${channel(a.b, b.b)}`
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

/** 두 색 중 밝은 쪽이 밝으면 어두운 선, 아니면 흰 선. 자리표시 초상 위의 사운드 시그니처 색(그라디언트 밝은 쪽에서도 보여야 한다). */
export function signatureInkFor(hexA: string, hexB: string): string {
  const bright = Math.max(luminance(hexA), luminance(hexB)) > 0.4
  return bright ? 'rgba(30, 24, 40, 0.8)' : 'rgba(255, 255, 255, 0.88)'
}
