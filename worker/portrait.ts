import { PORTRAIT_REQUEST_MAX_BYTES, SEED_MAX, type PortraitRequest } from '../shared/api.ts'
import { isTypeCode } from '../shared/typeCode.ts'
import { readBodyLimited } from './http.ts'

export type ValidationResult = { ok: true; value: PortraitRequest } | { ok: false; error: 'invalid_request' | 'too_large' }

/** 본문을 파싱·검증한다. 타입 코드와 32비트 정수 씨앗만 받는다. 제한은 바이트 기준이다. */
export async function parsePortraitRequest(request: Request): Promise<ValidationResult> {
  const text = await readBodyLimited(request, PORTRAIT_REQUEST_MAX_BYTES)
  if (text === null) return { ok: false, error: 'too_large' }

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
