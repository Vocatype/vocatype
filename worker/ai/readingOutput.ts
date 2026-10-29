import { CAPTION_MAX_CHARS, CAPTION_MIN_CHARS, READING_MAX_CHARS, READING_MIN_CHARS } from '../../shared/api.ts'
import type { Locale } from '../../shared/locale.ts'
import type { ReadingOutput } from './types.ts'

/** 해요체 문장의 마지막 글자. …어요·…네요·…군요·…나요·…이에요는 '요', …지요의 준말은 '죠'로 끝난다. */
const POLITE_ENDINGS = new Set(['요', '죠'])

/**
 * 한국어 리딩의 모든 문장이 해요체로 끝나는지 본다(034). 합니다체(…니다)나 해라체(…다)가 섞이면 예외.
 * 문장은 끝 구두점(. ! ? …) 뒤 공백으로 나누고, 끝의 구두점·따옴표·닫는 괄호·물결을 뗀 마지막 글자를 본다.
 * 오류 메시지에는 몇 번째 문장인지만 넣는다(응답 본문은 로그에 남기지 않는다). 캡션은 명사구라 보지 않는다.
 */
export function checkKoreanPoliteStyle(reading: string): void {
  const sentences = reading.split(/(?<=[.!?…])\s+/).map((sentence) => sentence.replace(/[\s.!?…~"'“”‘’)\]」』]+$/u, '')).filter(Boolean)
  for (const [index, sentence] of sentences.entries()) {
    if (!POLITE_ENDINGS.has(sentence.at(-1) ?? '')) throw new Error(`reading style: sentence ${index + 1} is not 해요체`)
  }
}

/**
 * 모든 텍스트 제공자가 함께 쓰는 출력 검증. 두 모델이 같은 계약(리딩 20~600자, 캡션 2~100자 한 줄, 한국어는 해요체)을 지키는지 한 곳에서 본다.
 * 형태가 다르거나 길이·문체를 벗어나면 예외를 던지고, 체인은 다음 제공자로 넘어간다(Claude 는 그 전에 한 번 더 부른다).
 */
export function normalizeReadingOutput(value: unknown, locale: Locale): ReadingOutput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('response is not an object')
  const { reading, caption } = value as { reading?: unknown; caption?: unknown }
  const cleanReading = typeof reading === 'string' ? reading.replace(/\s+/g, ' ').trim() : ''
  const cleanCaption = typeof caption === 'string' ? caption.replace(/\s+/g, ' ').trim() : ''
  if (cleanReading.length < READING_MIN_CHARS || cleanReading.length > READING_MAX_CHARS) throw new Error(`reading length ${cleanReading.length}`)
  if (cleanCaption.length < CAPTION_MIN_CHARS || cleanCaption.length > CAPTION_MAX_CHARS) throw new Error(`caption length ${cleanCaption.length}`)
  if (locale === 'ko') checkKoreanPoliteStyle(cleanReading)
  return { reading: cleanReading, caption: cleanCaption }
}

/** JSON 문자열을 파싱해 검증한다. 일부 모델은 코드 펜스로 감싸 돌려주므로 앞뒤 펜스는 벗긴다. */
export function parseReadingJson(text: string, locale: Locale): ReadingOutput {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    throw new Error('response is not JSON')
  }
  return normalizeReadingOutput(parsed, locale)
}
