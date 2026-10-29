import { READING_AXIS_KEYS, READING_REQUEST_MAX_BYTES, type ReadingAxes, type ReadingRequest } from '../shared/api.ts'
import { isLocale } from '../shared/locale.ts'
import { isTypeCode } from '../shared/typeCode.ts'
import { readBodyLimited } from './http.ts'

export type ReadingValidationResult = { ok: true; value: ReadingRequest } | { ok: false; error: 'invalid_request' | 'too_large' }

const INVALID: ReadingValidationResult = { ok: false, error: 'invalid_request' }

/** 소수 둘째 자리로 반올림한다. 클라이언트도 같은 규칙으로 보내지만 서버가 다시 적용한다. */
export function roundAxis(value: number): number {
  return Math.round(value * 100) / 100
}

/** 0..1 사이의 여섯 축을 반올림해 돌려준다. 하나라도 없거나 범위를 벗어나면 null. 추가 키는 버린다. 리딩과 초상(035)이 함께 쓴다. */
export function validateAxes(axes: unknown): ReadingAxes | null {
  if (typeof axes !== 'object' || axes === null) return null
  const cleaned = {} as ReadingAxes
  for (const key of READING_AXIS_KEYS) {
    const value = (axes as Record<string, unknown>)[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return null
    cleaned[key] = roundAxis(value)
  }
  return cleaned
}

/** 타입 코드, 0..1 사이의 여섯 축, 로케일만 받는다. 추가 필드는 버린다. */
export function validateReadingBody(body: unknown): ReadingValidationResult {
  if (typeof body !== 'object' || body === null) return INVALID
  const { typeCode, axes, locale } = body as { typeCode?: unknown; axes?: unknown; locale?: unknown }
  if (!isTypeCode(typeCode)) return INVALID
  if (!isLocale(locale)) return INVALID
  const cleaned = validateAxes(axes)
  if (!cleaned) return INVALID
  return { ok: true, value: { typeCode, axes: cleaned, locale } }
}

/** 본문을 바이트 기준 1KB까지만 읽어 파싱·검증한다. */
export async function parseReadingRequest(request: Request): Promise<ReadingValidationResult> {
  const text = await readBodyLimited(request, READING_REQUEST_MAX_BYTES)
  if (text === null) return { ok: false, error: 'too_large' }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return INVALID
  }
  return validateReadingBody(body)
}
