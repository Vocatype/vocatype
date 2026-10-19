import { ALL_TYPE_CODES, type TypeCode } from './typeCode.ts'

export interface Localized {
  ko: string
  en: string
}

/* ---------- 축 ---------- */

export type AxisKey = 'temperature' | 'texture' | 'pace' | 'flow'

export interface AxisDescriptor {
  key: AxisKey
  /** 왼쪽 글자(기본값 1쪽)와 오른쪽 글자. */
  letters: [string, string]
  labels: [Localized, Localized]
  title: Localized
}

export const AXES: readonly AxisDescriptor[] = [
  {
    key: 'temperature',
    letters: ['W', 'C'],
    labels: [
      { ko: '따뜻한', en: 'Warm' },
      { ko: '서늘한', en: 'Cool' },
    ],
    title: { ko: '온도', en: 'Temperature' },
  },
  {
    key: 'texture',
    letters: ['F', 'L'],
    labels: [
      { ko: '꽉 찬', en: 'Full' },
      { ko: '가벼운', en: 'Light' },
    ],
    title: { ko: '밀도', en: 'Texture' },
  },
  {
    key: 'pace',
    letters: ['Q', 'M'],
    labels: [
      { ko: '빠른', en: 'Quick' },
      { ko: '느긋한', en: 'Measured' },
    ],
    title: { ko: '속도', en: 'Pace' },
  },
  {
    key: 'flow',
    letters: ['V', 'E'],
    labels: [
      { ko: '생동하는', en: 'Vivid' },
      { ko: '고른', en: 'Even' },
    ],
    title: { ko: '흐름', en: 'Flow' },
  },
]

/** 타입 코드의 n번째 글자가 축의 왼쪽 값인지. */
export function axisValue(code: TypeCode, axis: AxisKey): 0 | 1 {
  const index = AXES.findIndex((item) => item.key === axis)
  const descriptor = AXES[index]
  if (!descriptor) return 0
  return code[index] === descriptor.letters[0] ? 0 : 1
}

/* ---------- 16 타입 ---------- */

export interface VoiceType {
  code: TypeCode
  name: Localized
  description: Localized
}

const TYPES: Record<TypeCode, Omit<VoiceType, 'code'>> = {
  WFQV: {
    name: { ko: '불꽃 이야기꾼', en: 'The Fireside Storyteller' },
    description: {
      ko: '따뜻하고 꽉 찬 목소리가 빠르게 굽이칩니다. 듣는 사람을 이야기 한가운데로 끌어들이는 힘이 있어요.',
      en: 'A warm, full voice that moves fast and bends with every turn of the story. People lean in when you talk.',
    },
  },
  WFQE: {
    name: { ko: '한낮의 라디오 진행자', en: 'The Midday Radio Host' },
    description: {
      ko: '따뜻하고 안정적인 톤으로 빠르게, 그러나 흔들림 없이 말합니다. 어떤 자리든 편안하게 이끄는 목소리예요.',
      en: 'Warm and steady, quick but never rushed. The kind of voice that keeps any room at ease.',
    },
  },
  WFMV: {
    name: { ko: '노을빛 낭독가', en: 'The Sunset Narrator' },
    description: {
      ko: '깊고 따뜻한 음색이 천천히, 풍부한 억양으로 흐릅니다. 한 문장에도 온도가 담기는 목소리예요.',
      en: 'Deep and warm, unhurried, rich in intonation. Every sentence arrives with its own temperature.',
    },
  },
  WFME: {
    name: { ko: '깊은 숲의 안내자', en: 'The Deep Forest Guide' },
    description: {
      ko: '낮고 묵직한 목소리가 고르게, 느긋하게 이어집니다. 듣고 있으면 마음이 가라앉는 목소리예요.',
      en: 'Low, grounded and even, moving at its own pace. Listening to you feels like exhaling.',
    },
  },
  WLQV: {
    name: { ko: '봄바람 수다쟁이', en: 'The Spring Breeze Chatterbox' },
    description: {
      ko: '가볍고 따뜻한 목소리가 통통 튀며 빠르게 오갑니다. 대화에 생기를 불어넣는 목소리예요.',
      en: 'Light, warm and quick, bouncing from one thought to the next. You make conversations feel alive.',
    },
  },
  WLQE: {
    name: { ko: '햇살 아래 산책자', en: 'The Sunlit Stroller' },
    description: {
      ko: '부드럽고 따뜻한 톤이 경쾌하게, 그러나 고르게 이어집니다. 듣는 사람이 자연스럽게 미소 짓는 목소리예요.',
      en: 'Soft, warm and brisk, flowing evenly along. People find themselves smiling without noticing.',
    },
  },
  WLMV: {
    name: { ko: '캠프파이어 시인', en: 'The Campfire Poet' },
    description: {
      ko: '따뜻한 숨결이 천천히, 억양을 살려 흐릅니다. 말보다 여운이 길게 남는 목소리예요.',
      en: 'Warm breath, slow tempo, expressive rise and fall. What you say lingers long after you stop.',
    },
  },
  WLME: {
    name: { ko: '다락방의 자장가', en: 'The Attic Lullaby' },
    description: {
      ko: '가볍고 따뜻한 목소리가 느긋하고 고르게 이어집니다. 긴장을 풀어 주는 목소리예요.',
      en: 'Light and warm, slow and even. The voice that lets everyone put their shoulders down.',
    },
  },
  CFQV: {
    name: { ko: '새벽 도시의 앵커', en: 'The Dawn City Anchor' },
    description: {
      ko: '또렷하고 꽉 찬 목소리가 빠르게, 강약을 살려 움직입니다. 핵심을 짚어 전하는 힘이 있어요.',
      en: 'Clear, full and fast, with sharp dynamics. You get to the point and people remember it.',
    },
  },
  CFQE: {
    name: { ko: '유리 같은 해설자', en: 'The Glass Commentator' },
    description: {
      ko: '맑고 단단한 톤으로 빠르고 고르게 말합니다. 복잡한 이야기도 투명하게 들리게 하는 목소리예요.',
      en: 'Crisp, firm, quick and even. Complicated things sound transparent when you explain them.',
    },
  },
  CFMV: {
    name: { ko: '겨울 바다의 지휘자', en: 'The Winter Sea Conductor' },
    description: {
      ko: '서늘하고 깊은 목소리가 천천히, 큰 파도처럼 오르내립니다. 한마디에 무게가 실리는 목소리예요.',
      en: 'Cool and deep, slow, rising and falling like a long swell. Your words carry weight.',
    },
  },
  CFME: {
    name: { ko: '달빛 사서', en: 'The Moonlit Librarian' },
    description: {
      ko: '차분하고 단단한 음색이 고르게, 느긋하게 이어집니다. 믿고 기대게 되는 목소리예요.',
      en: 'Calm, firm and even, never in a hurry. A voice people trust before they know why.',
    },
  },
  CLQV: {
    name: { ko: '은빛 종달새', en: 'The Silver Lark' },
    description: {
      ko: '맑고 가벼운 목소리가 빠르게, 생동감 있게 날아오릅니다. 공간을 환하게 만드는 목소리예요.',
      en: 'Bright, light and quick, lifting with every phrase. You brighten whatever room you are in.',
    },
  },
  CLQE: {
    name: { ko: '비 오는 날의 바리스타', en: 'The Rainy Day Barista' },
    description: {
      ko: '맑고 가벼운 톤이 경쾌하고 고르게 이어집니다. 가까이에서 조곤조곤 들리는 목소리예요.',
      en: 'Clear, light, brisk and even. A close, quiet voice that makes small talk feel warm.',
    },
  },
  CLMV: {
    name: { ko: '안개 속 첼리스트', en: 'The Misty Cellist' },
    description: {
      ko: '서늘하고 섬세한 목소리가 천천히, 억양을 살려 흐릅니다. 말 사이의 숨까지 음악이 되는 목소리예요.',
      en: 'Cool and delicate, slow and expressive. Even the pauses between your words sound like music.',
    },
  },
  CLME: {
    name: { ko: '서리 내린 아침의 서점 주인', en: 'The Frost Morning Bookseller' },
    description: {
      ko: '맑고 가벼운 음색이 고르고 느긋하게 이어집니다. 조용히 오래 듣고 싶은 목소리예요.',
      en: 'Clear and light, even and unhurried. The kind of voice you could listen to for a long while.',
    },
  },
}

export function getVoiceType(code: TypeCode): VoiceType {
  return { code, ...TYPES[code] }
}

export const VOICE_TYPES: readonly VoiceType[] = ALL_TYPE_CODES.map(getVoiceType)

/* ---------- 퍼스널 컬러 ---------- */

export type Season = 'spring-warm' | 'summer-cool' | 'autumn-warm' | 'winter-cool'

export interface PersonalColor {
  season: Season
  name: Localized
  description: Localized
  /** 메인 → 보조 순. 첫 색이 대표색. */
  palette: readonly string[]
}

const PERSONAL_COLORS: Record<Season, Omit<PersonalColor, 'season'>> = {
  'spring-warm': {
    name: { ko: '봄 웜', en: 'Spring Warm' },
    description: { ko: '맑고 환한 따뜻함. 피치, 코랄, 버터 옐로가 잘 어울려요.', en: 'Bright, clear warmth. Peach, coral and butter yellow suit you.' },
    palette: ['#F28C7A', '#F6C1A6', '#F9D976', '#A8D8B9', '#FFF4E0'],
  },
  'summer-cool': {
    name: { ko: '여름 쿨', en: 'Summer Cool' },
    description: { ko: '부드럽고 차분한 서늘함. 라벤더, 파우더 블루, 로즈 핑크가 잘 어울려요.', en: 'Soft, muted coolness. Lavender, powder blue and rose pink suit you.' },
    palette: ['#9A8CD6', '#C9B6E4', '#A7C7E7', '#F4C2C2', '#EEEFF5'],
  },
  'autumn-warm': {
    name: { ko: '가을 웜', en: 'Autumn Warm' },
    description: { ko: '깊고 풍성한 따뜻함. 브릭, 머스터드, 올리브가 잘 어울려요.', en: 'Deep, rich warmth. Brick, mustard and olive suit you.' },
    palette: ['#B8432F', '#D4A017', '#6B8E23', '#8B5A2B', '#F3E9DC'],
  },
  'winter-cool': {
    name: { ko: '겨울 쿨', en: 'Winter Cool' },
    description: { ko: '선명하고 또렷한 서늘함. 로열 블루, 마젠타, 에메랄드가 잘 어울려요.', en: 'Vivid, high-contrast coolness. Royal blue, magenta and emerald suit you.' },
    palette: ['#1E3A8A', '#C2185B', '#0F766E', '#CFE8FF', '#FFFFFF'],
  },
}

export function seasonFor(code: TypeCode): Season {
  const warm = axisValue(code, 'temperature') === 0
  const full = axisValue(code, 'texture') === 0
  if (warm) return full ? 'autumn-warm' : 'spring-warm'
  return full ? 'winter-cool' : 'summer-cool'
}

export function getPersonalColor(code: TypeCode): PersonalColor {
  const season = seasonFor(code)
  return { season, ...PERSONAL_COLORS[season] }
}

/* ---------- 시그니처 향 ---------- */

export interface Scent {
  name: Localized
  top: readonly Localized[]
  middle: readonly Localized[]
  base: readonly Localized[]
  mood: Localized
}

const TOP_NOTES: Record<0 | 1, readonly Localized[]> = {
  0: [
    { ko: '베르가못', en: 'Bergamot' },
    { ko: '자몽', en: 'Grapefruit' },
    { ko: '유자', en: 'Yuzu' },
  ],
  1: [
    { ko: '녹차', en: 'Green tea' },
    { ko: '무화과 잎', en: 'Fig leaf' },
    { ko: '홍차', en: 'Black tea' },
  ],
}

const MIDDLE_NOTES: Record<0 | 1, readonly Localized[]> = {
  0: [
    { ko: '자스민', en: 'Jasmine' },
    { ko: '작약', en: 'Peony' },
    { ko: '장미', en: 'Rose' },
  ],
  1: [
    { ko: '라벤더', en: 'Lavender' },
    { ko: '세이지', en: 'Sage' },
    { ko: '아이리스', en: 'Iris' },
  ],
}

const BASE_NOTES: Record<0 | 1, readonly Localized[]> = {
  0: [
    { ko: '앰버', en: 'Amber' },
    { ko: '바닐라', en: 'Vanilla' },
    { ko: '샌달우드', en: 'Sandalwood' },
  ],
  1: [
    { ko: '화이트 머스크', en: 'White musk' },
    { ko: '시더우드', en: 'Cedarwood' },
    { ko: '베티버', en: 'Vetiver' },
  ],
}

const SCENT_MOODS: Record<`${0 | 1}${0 | 1}`, Localized> = {
  '00': { ko: '포근하게 피어오르다가 오래 남는 향', en: 'Blooms warmly and lingers long' },
  '01': { ko: '따뜻하고 차분하게 가라앉는 향', en: 'Warm, settling into a calm hush' },
  '10': { ko: '맑게 터지고 선명하게 남는 향', en: 'Breaks clean and stays vivid' },
  '11': { ko: '서늘하고 고요하게 번지는 향', en: 'Cool and quiet, spreading slowly' },
}

export function getScent(code: TypeCode): Scent {
  const temperature = axisValue(code, 'temperature')
  const texture = axisValue(code, 'texture')
  const pace = axisValue(code, 'pace')
  const flow = axisValue(code, 'flow')
  // 꽉 찬 목소리는 무거운 앞쪽 노트, 가벼운 목소리는 가벼운 뒤쪽 노트를 대표로 쓴다.
  const pick = (notes: readonly Localized[]) => (texture === 0 ? notes.slice(0, 2) : notes.slice(1, 3))
  const top = pick(TOP_NOTES[pace])
  const middle = pick(MIDDLE_NOTES[flow])
  const base = pick(BASE_NOTES[temperature])
  const [b, m, t] = [base[0], middle[0], top[0]]
  return {
    name: {
      ko: [b?.ko, m?.ko, t?.ko].filter(Boolean).join(' · '),
      en: [b?.en, m?.en, t?.en].filter(Boolean).join(' · '),
    },
    top,
    middle,
    base,
    mood: SCENT_MOODS[`${temperature}${flow}`],
  }
}

/* ---------- 궁합 ---------- */

export interface Compatibility {
  /** 밀도와 속도가 반대인 타입. 같은 온도·흐름이라 분위기는 통하고 리듬이 서로를 채운다. */
  best: VoiceType
  /** 네 축이 모두 반대인 타입. */
  opposite: VoiceType
  bestReason: Localized
  oppositeReason: Localized
}

function flip(code: TypeCode, axes: readonly AxisKey[]): TypeCode {
  const letters = code.split('')
  for (const axis of axes) {
    const index = AXES.findIndex((item) => item.key === axis)
    const descriptor = AXES[index]
    if (!descriptor) continue
    letters[index] = letters[index] === descriptor.letters[0] ? descriptor.letters[1] : descriptor.letters[0]
  }
  return letters.join('') as TypeCode
}

export function getCompatibility(code: TypeCode): Compatibility {
  return {
    best: getVoiceType(flip(code, ['texture', 'pace'])),
    opposite: getVoiceType(flip(code, ['temperature', 'texture', 'pace', 'flow'])),
    bestReason: {
      ko: '온도와 흐름이 닮아 분위기가 통하고, 밀도와 속도가 반대라 대화에 빈틈이 없어요.',
      en: 'Same temperature and flow, so the mood matches; opposite texture and pace, so the conversation never stalls.',
    },
    oppositeReason: {
      ko: '네 축이 모두 반대예요. 낯설지만, 서로에게 없는 것을 가장 잘 보여 주는 상대예요.',
      en: 'Opposite on every axis. Unfamiliar, but the one who shows you most clearly what you lack.',
    },
  }
}

/* ---------- 이미지 프롬프트 ---------- */

/** 실사 초상화 생성용 영어 프롬프트. 성별·나이·인종은 지정하지 않는다. */
export function buildPortraitPrompt(code: TypeCode): string {
  const warm = axisValue(code, 'temperature') === 0
  const full = axisValue(code, 'texture') === 0
  const quick = axisValue(code, 'pace') === 0
  const vivid = axisValue(code, 'flow') === 0
  const color = getPersonalColor(code)
  const lighting = warm ? 'golden hour window light, warm color grading' : 'soft overcast daylight, cool color grading'
  const presence = full ? 'confident posture, grounded presence' : 'relaxed posture, airy presence'
  const expression = quick ? (vivid ? 'bright animated smile, eyes mid-laugh' : 'alert friendly half-smile') : vivid ? 'thoughtful expressive gaze, slight smile' : 'calm serene expression, soft eyes'
  const wardrobe = `simple ${color.name.en.toLowerCase()} palette clothing in ${color.palette[0]} tones`
  return [
    'Photorealistic head-and-shoulders portrait photograph of one person looking at the camera',
    lighting,
    presence,
    expression,
    wardrobe,
    'plain softly blurred studio background',
    '85mm lens, shallow depth of field, natural skin texture, high detail, editorial photography',
  ].join(', ')
}
