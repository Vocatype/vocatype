import type { Locale } from '../../i18n/locales'

export interface Script {
  id: string
  locale: Locale
  title: string
  author: string
  /** 발표·집필 연도. 표시용. */
  year: string
  /** 발췌면 true. 카드에 "발췌" 표시. */
  excerpt: boolean
  lines: string[]
}

/**
 * 낭독용 스크립트. 모두 저작권이 만료된(퍼블릭 도메인) 작품이다.
 * - 한국: 저자 사후 50년(1963년 이전 사망)으로 보호가 끝난 작품만 수록
 * - 영미: 1929년 이전 출판 또는 저자 사후 70년 경과 작품만 수록
 * 20~30초 안에 읽을 분량으로 맞췄다.
 */
export const SCRIPTS: readonly Script[] = [
  // ---------- 한국어 ----------
  {
    id: 'ko-seosi',
    locale: 'ko',
    title: '서시',
    author: '윤동주',
    year: '1941',
    excerpt: false,
    lines: [
      '죽는 날까지 하늘을 우러러',
      '한 점 부끄럼이 없기를,',
      '잎새에 이는 바람에도',
      '나는 괴로워했다.',
      '별을 노래하는 마음으로',
      '모든 죽어 가는 것을 사랑해야지',
      '그리고 나한테 주어진 길을',
      '걸어가야겠다.',
      '',
      '오늘 밤에도 별이 바람에 스치운다.',
    ],
  },
  {
    id: 'ko-jindallae',
    locale: 'ko',
    title: '진달래꽃',
    author: '김소월',
    year: '1922',
    excerpt: false,
    lines: [
      '나 보기가 역겨워',
      '가실 때에는',
      '말없이 고이 보내 드리우리다',
      '',
      '영변에 약산',
      '진달래꽃',
      '아름 따다 가실 길에 뿌리우리다',
      '',
      '가시는 걸음 걸음',
      '놓인 그 꽃을',
      '사뿐히 즈려밟고 가시옵소서',
      '',
      '나 보기가 역겨워',
      '가실 때에는',
      '죽어도 아니 눈물 흘리우리다',
    ],
  },
  {
    id: 'ko-cheongpodo',
    locale: 'ko',
    title: '청포도',
    author: '이육사',
    year: '1939',
    excerpt: true,
    lines: [
      '내 고장 칠월은',
      '청포도가 익어 가는 시절',
      '',
      '이 마을 전설이 주저리주저리 열리고',
      '먼 데 하늘이 꿈꾸며 알알이 들어와 박혀',
      '',
      '하늘 밑 푸른 바다가 가슴을 열고',
      '흰 돛단배가 곱게 밀려서 오면',
      '',
      '내가 바라는 손님은 고달픈 몸으로',
      '청포를 입고 찾아온다고 했으니',
    ],
  },
  {
    id: 'ko-nim',
    locale: 'ko',
    title: '님의 침묵',
    author: '한용운',
    year: '1926',
    excerpt: true,
    lines: [
      '님은 갔습니다. 아아, 사랑하는 나의 님은 갔습니다.',
      '푸른 산빛을 깨치고 단풍나무 숲을 향하여 난 작은 길을 걸어서, 차마 떨치고 갔습니다.',
      '',
      '우리는 만날 때에 떠날 것을 염려하는 것과 같이, 떠날 때에 다시 만날 것을 믿습니다.',
      '아아, 님은 갔지마는 나는 님을 보내지 아니하였습니다.',
      '제 곡조를 못 이기는 사랑의 노래는 님의 침묵을 휩싸고 돕니다.',
    ],
  },
  {
    id: 'ko-hyangsu',
    locale: 'ko',
    title: '향수',
    author: '정지용',
    year: '1927',
    excerpt: true,
    lines: [
      '넓은 벌 동쪽 끝으로',
      '옛이야기 지줄대는 실개천이 휘돌아 나가고,',
      '얼룩백이 황소가',
      '해설피 금빛 게으른 울음을 우는 곳,',
      '',
      '그곳이 차마 꿈엔들 잊힐 리야.',
      '',
      '질화로에 재가 식어지면',
      '비인 밭에 밤바람 소리 말을 달리고,',
      '엷은 졸음에 겨운 늙으신 아버지가',
      '짚베개를 돋아 고이시는 곳,',
      '',
      '그곳이 차마 꿈엔들 잊힐 리야.',
    ],
  },
  {
    id: 'ko-byeol',
    locale: 'ko',
    title: '별 헤는 밤',
    author: '윤동주',
    year: '1941',
    excerpt: true,
    lines: [
      '계절이 지나가는 하늘에는',
      '가을로 가득 차 있습니다.',
      '',
      '나는 아무 걱정도 없이',
      '가을 속의 별들을 다 헤일 듯합니다.',
      '',
      '별 하나에 추억과',
      '별 하나에 사랑과',
      '별 하나에 쓸쓸함과',
      '별 하나에 동경과',
      '별 하나에 시와',
      '별 하나에 어머니, 어머니,',
    ],
  },

  // ---------- English ----------
  {
    id: 'en-sonnet18',
    locale: 'en',
    title: 'Sonnet 18',
    author: 'William Shakespeare',
    year: '1609',
    excerpt: true,
    lines: [
      "Shall I compare thee to a summer's day?",
      'Thou art more lovely and more temperate:',
      'Rough winds do shake the darling buds of May,',
      "And summer's lease hath all too short a date;",
      'Sometime too hot the eye of heaven shines,',
      "And often is his gold complexion dimm'd;",
      'And every fair from fair sometime declines,',
      "By chance or nature's changing course untrimm'd;",
    ],
  },
  {
    id: 'en-stage',
    locale: 'en',
    title: 'All the world’s a stage',
    author: 'William Shakespeare',
    year: '1623',
    excerpt: true,
    lines: [
      "All the world's a stage,",
      'And all the men and women merely players;',
      'They have their exits and their entrances;',
      'And one man in his time plays many parts,',
      'His acts being seven ages.',
    ],
  },
  {
    id: 'en-hope',
    locale: 'en',
    title: '“Hope” is the thing with feathers',
    author: 'Emily Dickinson',
    year: '1891',
    excerpt: true,
    lines: [
      '“Hope” is the thing with feathers',
      'That perches in the soul,',
      'And sings the tune without the words,',
      'And never stops at all,',
      '',
      'And sweetest in the gale is heard;',
      'And sore must be the storm',
      'That could abash the little bird',
      'That kept so many warm.',
    ],
  },
  {
    id: 'en-invictus',
    locale: 'en',
    title: 'Invictus',
    author: 'William Ernest Henley',
    year: '1888',
    excerpt: true,
    lines: [
      'Out of the night that covers me,',
      'Black as the pit from pole to pole,',
      'I thank whatever gods may be',
      'For my unconquerable soul.',
      '',
      'In the fell clutch of circumstance',
      'I have not winced nor cried aloud.',
      'Under the bludgeonings of chance',
      'My head is bloody, but unbowed.',
    ],
  },
  {
    id: 'en-daffodils',
    locale: 'en',
    title: 'I Wandered Lonely as a Cloud',
    author: 'William Wordsworth',
    year: '1807',
    excerpt: true,
    lines: [
      'I wandered lonely as a cloud',
      "That floats on high o'er vales and hills,",
      'When all at once I saw a crowd,',
      'A host, of golden daffodils;',
      'Beside the lake, beneath the trees,',
      'Fluttering and dancing in the breeze.',
    ],
  },
  {
    id: 'en-gettysburg',
    locale: 'en',
    title: 'Gettysburg Address',
    author: 'Abraham Lincoln',
    year: '1863',
    excerpt: true,
    lines: [
      'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.',
      '',
      'Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure.',
    ],
  },
]

export function scriptsFor(locale: Locale): readonly Script[] {
  return SCRIPTS.filter((script) => script.locale === locale)
}

/** 로케일의 스크립트 중 하나를 무작위로 고른다. excludeId가 있으면 그 글은 피한다. */
export function pickScript(locale: Locale, excludeId?: string, random: () => number = Math.random): Script {
  const candidates = scriptsFor(locale)
  const pool = candidates.length > 1 ? candidates.filter((script) => script.id !== excludeId) : candidates
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length))
  const script = pool[index]
  if (!script) throw new Error(`no script for locale ${locale}`)
  return script
}

/** 낭독 예상 시간(초). 한국어는 분당 약 250자, 영어는 분당 약 150단어 기준. */
export function estimateReadingSeconds(script: Script): number {
  const text = script.lines.join(' ')
  if (script.locale === 'ko') {
    const chars = text.replace(/\s+/g, '').length
    return Math.round((chars / 250) * 60)
  }
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.round((words / 150) * 60)
}
