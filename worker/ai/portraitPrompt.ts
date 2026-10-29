import type { ReadingAxes, ReadingAxisKey } from '../../shared/api.ts'
import { getPersonalColor, getVoiceType } from '../../shared/catalog.ts'
import type { TypeCode } from '../../shared/typeCode.ts'

export interface PortraitPromptInput {
  typeCode: TypeCode
  /** 여섯 축(0..1, 소수 둘째 자리). 음높이는 쓰지 않는다. */
  axes: ReadingAxes
  /** 녹음마다 다른 씨앗(측정값 8개의 해시). 연출 후보를 고르는 데만 쓰고 문장에는 넣지 않는다. */
  seed: number
}

/**
 * 씨앗으로 고르는 연출 후보(035). 같은 타입이어도 녹음마다 외모·장면이 갈리게 한다. 조합은 4 × 3 × 4 × 5 × 6 × 3 = 4,320가지.
 * 성별·나이·인종을 가리키는 말은 넣지 않는다(portraitPrompt.test.ts 의 금지어 검사).
 */
export const STAGING = {
  angle: ['facing the camera', 'face turned slightly to one side', 'three-quarter view', 'glancing back over the shoulder'],
  framing: ['head-and-shoulders framing', 'close-up framing', 'waist-up framing'],
  background: ['plain softly blurred studio backdrop', 'softly blurred window-lit interior', 'softly blurred green park', 'softly blurred city street at dusk'],
  wardrobe: ['a knit sweater', 'a linen shirt', 'a denim jacket', 'a turtleneck', 'a simple crew-neck tee'],
  hair: ['short cropped hair', 'shoulder-length hair', 'long wavy hair', 'hair tied back', 'curly hair', 'a close buzz cut'],
  accessory: ['', 'glasses', 'small earrings'],
} as const

type StagingKey = keyof typeof STAGING
const STAGING_KEYS = Object.keys(STAGING) as StagingKey[]

/**
 * 축 값을 소리의 뜻이 아니라 그림의 뜻으로 넘긴다(035). 음높이는 외모(성별·나이)와 가장 쉽게 연결되어 뺀다.
 * [축, 그림에서의 이름, 0일 때, 1일 때]
 */
export const MOOD_AXES: readonly (readonly [Exclude<ReadingAxisKey, 'pitch'>, string, string, string])[] = [
  ['warmth', 'lighting warmth', 'cool bluish daylight', 'deep golden light'],
  ['density', 'color richness', 'pale, airy colors', 'deep, saturated colors'],
  ['pace', 'sense of motion', 'perfectly still pose', 'caught mid-movement'],
  ['variation', 'expression liveliness', 'calm, serene expression', 'animated expression, mid-laugh'],
  ['brightness', 'overall brightness', 'dark, low-key image', 'bright, high-key image'],
]

/**
 * 씨앗과 항목 번호를 섞은 32비트 정수로 후보 하나를 고른다. 항목마다 다르게 섞어 항목끼리 짝지어 움직이지 않게 한다.
 * 같은 씨앗이면 언제나 같은 후보다.
 */
export function pickFor<T>(list: readonly T[], seed: number, salt: number): T {
  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0
  x = (x ^ (x >>> 16)) >>> 0
  return list[x % list.length]!
}

/**
 * 실사 초상화 생성용 영어 프롬프트. 서버가 만들며, 모델에는 이 문장만 간다(씨앗 숫자·타입 코드·음성 없음).
 * 성별·나이·인종은 지정하지 않고, 축 값으로 정하지 말라고 적는다.
 */
export function buildPortraitPrompt({ typeCode, axes, seed }: PortraitPromptInput): string {
  const staging = Object.fromEntries(STAGING_KEYS.map((key, index) => [key, pickFor(STAGING[key], seed, index)])) as { [K in StagingKey]: (typeof STAGING)[K][number] }
  const color = getPersonalColor(typeCode)
  const type = getVoiceType(typeCode)
  const outfit = `wearing ${staging.wardrobe} in ${color.promptColors} tones${staging.accessory ? `, ${staging.accessory}` : ''}`
  return [
    'Photorealistic portrait photograph of one person looking at the camera.',
    `${staging.angle}, ${staging.framing}, ${staging.background}.`,
    `${outfit}, ${staging.hair}.`,
    `Overall feeling inspired by the title "${type.name.en}" — use it only as a mood; do not show any text, letters or logos in the image.`,
    "Mood values from 0 to 1. Use them only for light, color and mood, never to decide the person's gender, age or ethnicity:",
    ...MOOD_AXES.map(([key, label, low, high]) => `- ${label}: ${axes[key].toFixed(2)} (0 = ${low}, 1 = ${high})`),
    '85mm lens, shallow depth of field, natural skin texture, high detail, editorial photography.',
  ].join('\n')
}
