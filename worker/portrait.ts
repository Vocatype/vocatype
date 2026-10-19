import { PORTRAIT_REQUEST_MAX_BYTES, SEED_MAX, type PortraitRequest } from '../shared/api.ts'
import { isTypeCode } from '../shared/typeCode.ts'

export type ValidationResult = { ok: true; value: PortraitRequest } | { ok: false; error: 'invalid_request' | 'too_large' }

/**
 * 본문을 최대 바이트까지만 읽는다. 넘으면 null. 스트림을 조금씩 읽으므로 chunked 본문도 제한 전에 메모리에 다 올라가지 않는다.
 */
export async function readBodyLimited(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

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
