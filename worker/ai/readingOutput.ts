import { CAPTION_MAX_CHARS, CAPTION_MIN_CHARS, READING_MAX_CHARS, READING_MIN_CHARS } from '../../shared/api.ts'
import type { Locale } from '../../shared/locale.ts'
import type { ReadingOutput } from './types.ts'

/** 문장 경계: 끝 구두점(전각·말줄임 포함, 닫는 따옴표·괄호가 붙어도 된다) 뒤의 공백. */
const SENTENCE_BREAK = /(?<=[.!?…⋯。！？~]["'“”‘’)\]」』》〉]*)\s+/u
/** 문장 끝에서 떼어 내는 것: 공백, 끝 구두점, 따옴표, 닫는 괄호, 이모지. */
const SENTENCE_TAIL = /[\s.!?…⋯。！？~"'“”‘’)\]」』》〉\p{Extended_Pictographic}\uFE0F\u200D]+$/u

/**
 * 한국어 리딩에 합니다체(…니다)·해라체(…다) 문장이 섞였는지 본다(034). 끝 글자가 '다'인 문장이 하나라도 있으면 예외.
 * 해요체(…요·…죠)만 통과시키는 엄격한 판정은 문장 중간의 물음표·인용·이모지 같은 정상 글을 거절해서, 사용자가 지적한 '…다' 종결만 잡는다(1차 리뷰 #4).
 * 문장은 SENTENCE_BREAK 로 나누고 SENTENCE_TAIL 을 뗀 마지막 글자를 본다. 오류 메시지에는 몇 번째 문장인지만 넣는다(응답 본문은 로그에 남기지 않는다).
 * 캡션은 명사구라 보지 않는다.
 */
export function checkKoreanPoliteStyle(reading: string): void {
  const sentences = reading.split(SENTENCE_BREAK).map((sentence) => sentence.replace(SENTENCE_TAIL, '')).filter(Boolean)
  for (const [index, sentence] of sentences.entries()) {
    if (sentence.at(-1) === '다') throw new Error(`reading style: sentence ${index + 1} ends in -다, not 해요체`)
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
