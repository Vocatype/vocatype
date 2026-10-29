import { describe, expect, it } from 'vitest'
import { checkKoreanPoliteStyle, normalizeReadingOutput } from './readingOutput.ts'

const CAPTION = '시원한 아침 공기처럼 상쾌한 목소리'

describe('checkKoreanPoliteStyle', () => {
  it('해요체 글은 문장 끝이 어떻게 생겼든 통과한다', () => {
    const polite = [
      '따뜻한 숨결이 문장을 데워요. 듣는 사람이 기대게 되죠! 이렇게 말하는 사람이 또 있을까요?',
      // 맨 끝의 닫는 따옴표·물결·말줄임과 마침표 없는 끝 문장.
      '맑은 소리가 이어져요. 서두르지 않아도 충분해요.”',
      '여운이 오래 남는 결이에요~ 마지막 문장은 마침표가 없어요',
      '목소리가 맑아요⋯ 듣는 사람이 기대게 되죠⋯',
      '목소리가 맑아요。 듣는 사람이 기대게 되죠？',
      // 이모지, 괄호, 줄표, 문장 중간의 물음표·느낌표, 인용 속 반말, 영어 약어.
      '듣는 사람이 기대게 되죠 😊',
      '듣는 사람이 기대게 되죠 (정말로).',
      '이렇게 맑을 수 있을까? 싶은 목소리예요.',
      '와! 하고 감탄이 나오는 목소리예요.',
      '"괜찮아. 다 잘될 거야." 목소리가 그렇게 말하는 것 같아요.',
      '빠름 vs. 느림 사이에서 균형을 잡아요.',
    ]
    for (const reading of polite) expect(() => checkKoreanPoliteStyle(reading), reading).not.toThrow()
  })

  it('…다로 끝나는 문장(합니다체·해라체)이 섞이면 몇 번째 문장인지만 담아 실패한다', () => {
    const cases: [string, number][] = [
      ['목소리가 시원한 바람처럼 빠르게 흘러나옵니다. 말하는 동안 여유로움이 느껴져요. 은은한 밝기와 선명한 음색이 조화롭습니다.', 1],
      ['여운이 남아요. 리듬이 살아 있다.', 2],
      // 닫는 따옴표·괄호, 전각 마침표, 말줄임, 물결 뒤에서도 문장을 나눈다(1차 리뷰 #3).
      ['목소리가 흘러나옵니다.” 듣는 사람이 기대게 되죠.', 1],
      ['목소리가 흘러나옵니다.) 듣는 사람이 기대게 되죠.', 1],
      ['목소리가 흘러나옵니다。 듣는 사람이 기대게 되죠.', 1],
      ['목소리가 흘러나옵니다⋯ 듣는 사람이 기대게 되죠.', 1],
      ['목소리가 흘러나옵니다~ 듣는 사람이 기대게 되죠.', 1],
      ['듣는 사람이 기대게 돼요. 목소리가 흘러나옵니다 😊', 2],
    ]
    for (const [reading, sentence] of cases) expect(() => checkKoreanPoliteStyle(reading), reading).toThrow(`reading style: sentence ${sentence} ends in -다, not 해요체`)
    const error = (() => {
      try {
        checkKoreanPoliteStyle(cases[0]![0])
      } catch (cause) {
        return cause as Error
      }
    })()
    expect(error?.message).not.toContain('흘러나옵니다')
  })
})

describe('normalizeReadingOutput', () => {
  it('한국어 요청에만 문체를 보고, 캡션(명사구)은 보지 않는다', () => {
    const mixed = { reading: '목소리가 시원한 바람처럼 흘러나옵니다. 말하는 동안 여유로움이 느껴져요. 듣는 사람이 따라가게 돼요.', caption: CAPTION }
    expect(() => normalizeReadingOutput(mixed, 'ko')).toThrow(/reading style/)
    expect(normalizeReadingOutput(mixed, 'en')).toEqual(mixed)
    const polite = { reading: '목소리가 시원한 바람처럼 흘러나와요. 말하는 동안 여유로움이 느껴져요. 듣는 사람이 따라가게 돼요.', caption: CAPTION }
    expect(normalizeReadingOutput(polite, 'ko')).toEqual(polite)
  })
})
