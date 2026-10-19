/**
 * 보이스 타입 코드. 네 축의 글자를 이어 붙인 4글자다.
 * 온도 W/C · 밀도 F/L · 속도 Q/M · 흐름 V/E. 예: WFQV
 * 앱과 Worker가 함께 쓴다(Worker는 요청 검증과 프롬프트 생성에 사용).
 */
export const AXIS_LETTERS = {
  temperature: ['W', 'C'],
  texture: ['F', 'L'],
  pace: ['Q', 'M'],
  flow: ['V', 'E'],
} as const

export type TypeCode = `${'W' | 'C'}${'F' | 'L'}${'Q' | 'M'}${'V' | 'E'}`

export const ALL_TYPE_CODES: readonly TypeCode[] = (['W', 'C'] as const).flatMap((a) =>
  (['F', 'L'] as const).flatMap((b) =>
    (['Q', 'M'] as const).flatMap((c) => (['V', 'E'] as const).map((d) => `${a}${b}${c}${d}` as TypeCode)),
  ),
)

export function isTypeCode(value: unknown): value is TypeCode {
  return typeof value === 'string' && (ALL_TYPE_CODES as readonly string[]).includes(value)
}
