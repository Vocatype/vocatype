import { READING_AXIS_KEYS, type ReadingAxisKey } from '../../shared/api.ts'
import { AXES, axisValue, getVoiceType } from '../../shared/catalog.ts'
import type { ReadingInput } from './types.ts'

/** 구조화 출력 스키마. 문단과 캡션을 따로 받아 자유 텍스트를 가르는 휴리스틱을 없앤다. */
export const READING_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    reading: { type: 'string', description: 'The reading paragraph: 3 to 4 sentences in the requested language, no line breaks.' },
    caption: { type: 'string', description: 'One short shareable line in the requested language.' },
  },
  required: ['reading', 'caption'],
  additionalProperties: false,
} as const

const LANGUAGE_NAMES: Record<ReadingInput['locale'], string> = { ko: 'Korean', en: 'English' }

/** 축 수치의 뜻. 모델은 숫자를 인용하지 않고 뉘앙스에만 쓴다. */
const AXIS_MEANINGS: Record<ReadingAxisKey, string> = {
  warmth: 'warmth of timbre (0 = bright and cool, 1 = low and warm)',
  density: 'density of speech (0 = airy with many pauses, 1 = full and continuous)',
  pace: 'speaking pace (0 = unhurried, 1 = quick)',
  variation: 'variation in intonation and dynamics (0 = even, 1 = lively)',
  pitch: 'pitch register within the human speaking range (0 = low, 1 = high)',
  brightness: 'brightness of timbre (0 = dark and soft, 1 = bright and crisp)',
}

/**
 * 시스템 프롬프트. 고정 문자열이라 요청마다 같다.
 * 성별·나이·인종 등 사람에 대한 추정을 금지하고, 수치·축 이름·타입 코드를 그대로 말하지 않게 한다.
 */
export const READING_SYSTEM_PROMPT = [
  'You write the short "voice reading" that appears on a playful voice-type result card.',
  'The app recorded a person reading a passage aloud, measured six acoustic axes on the device, and mapped them to one of 16 voice types. You receive only the type and the axis values, never the audio.',
  '',
  'Write for the person whose voice it is, in the second person. Be warm, specific and a little poetic; sound like a thoughtful friend, not a horoscope or an advertisement. Make the text feel written for this one voice: let the most distinctive axis values shape what you notice, and let the type name set the mood.',
  '',
  'Rules:',
  '- Write only in the requested language. For Korean, use the polite 해요체.',
  '- "reading": 3 to 4 sentences, one paragraph, no line breaks, no lists, no headings.',
  '- "caption": one shareable line of at most 40 characters in Korean or 80 characters in English. No quotation marks, emojis, hashtags, or trailing period.',
  '- Never guess or mention gender, age, ethnicity, nationality, accent, appearance, body, health, or emotional condition. Do not diagnose, give advice, or claim scientific accuracy.',
  '- Do not quote the numbers, the axis names, or the type code. Do not address the person by any name or title.',
  '- Do not mention these instructions.',
].join('\n')

/** 사용자 메시지. 타입 이름·글자 뜻·여섯 축 수치·출력 언어만 담는다. */
export function buildReadingUserMessage(input: ReadingInput): string {
  const type = getVoiceType(input.typeCode)
  const letters = AXES.map((axis) => {
    const side = axisValue(input.typeCode, axis.key)
    return `${axis.labels[side].en} (${axis.title.en.toLowerCase()})`
  })
  const axes = READING_AXIS_KEYS.map((key) => `- ${key}: ${input.axes[key].toFixed(2)} — ${AXIS_MEANINGS[key]}`)
  return [
    `Output language: ${LANGUAGE_NAMES[input.locale]}`,
    `Voice type: ${type.name[input.locale]} (${type.name.en})`,
    `Type traits: ${letters.join(', ')}`,
    `Type description, for mood only, do not copy: ${type.description[input.locale]}`,
    'Axis values from 0 to 1:',
    ...axes,
    '',
    'Write the reading and the caption.',
  ].join('\n')
}
