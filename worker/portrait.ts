import { PORTRAIT_REQUEST_MAX_BYTES, SEED_MAX, type PortraitRequest } from '../shared/api.ts'
import { isTypeCode } from '../shared/typeCode.ts'

export type ValidationResult = { ok: true; value: PortraitRequest } | { ok: false; error: 'invalid_request' | 'too_large' }

/** 본문을 파싱·검증한다. 타입 코드와 32비트 정수 씨앗만 받는다. */
export async function parsePortraitRequest(request: Request): Promise<ValidationResult> {
  const length = Number(request.headers.get('content-length') ?? '0')
  if (length > PORTRAIT_REQUEST_MAX_BYTES) return { ok: false, error: 'too_large' }

  const text = await request.text()
  if (text.length > PORTRAIT_REQUEST_MAX_BYTES) return { ok: false, error: 'too_large' }

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return { ok: false, error: 'invalid_request' }
  }
  return validatePortraitBody(body)
}

export function validatePortraitBody(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid_request' }
  const { typeCode, seed } = body as { typeCode?: unknown; seed?: unknown }
  if (!isTypeCode(typeCode)) return { ok: false, error: 'invalid_request' }
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > SEED_MAX) {
    return { ok: false, error: 'invalid_request' }
  }
  return { ok: true, value: { typeCode, seed } }
}
