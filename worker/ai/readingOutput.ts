import { CAPTION_MAX_CHARS, CAPTION_MIN_CHARS, READING_MAX_CHARS, READING_MIN_CHARS } from '../../shared/api.ts'
import type { ReadingOutput } from './types.ts'

/**
 * 모든 텍스트 제공자가 함께 쓰는 출력 검증. 두 모델이 같은 계약(리딩 20~600자, 캡션 2~100자 한 줄)을 지키는지 한 곳에서 본다.
 * 형태가 다르거나 길이를 벗어나면 예외를 던지고, 체인은 다음 제공자로 넘어간다.
 */
export function normalizeReadingOutput(value: unknown): ReadingOutput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('response is not an object')
  const { reading, caption } = value as { reading?: unknown; caption?: unknown }
  const cleanReading = typeof reading === 'string' ? reading.replace(/\s+/g, ' ').trim() : ''
  const cleanCaption = typeof caption === 'string' ? caption.replace(/\s+/g, ' ').trim() : ''
  if (cleanReading.length < READING_MIN_CHARS || cleanReading.length > READING_MAX_CHARS) throw new Error(`reading length ${cleanReading.length}`)
  if (cleanCaption.length < CAPTION_MIN_CHARS || cleanCaption.length > CAPTION_MAX_CHARS) throw new Error(`caption length ${cleanCaption.length}`)
  return { reading: cleanReading, caption: cleanCaption }
}

/** JSON 문자열을 파싱해 검증한다. 일부 모델은 코드 펜스로 감싸 돌려주므로 앞뒤 펜스는 벗긴다. */
export function parseReadingJson(text: string): ReadingOutput {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    throw new Error('response is not JSON')
  }
  return normalizeReadingOutput(parsed)
}
