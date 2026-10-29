import { describe, expect, it } from 'vitest'
import { checkKoreanPoliteStyle, normalizeReadingOutput } from './readingOutput.ts'

const CAPTION = '시원한 아침 공기처럼 상쾌한 목소리'

describe('checkKoreanPoliteStyle', () => {
  it('모든 문장이 …요·…죠로 끝나면 통과한다(구두점·따옴표·물결·끝 마침표 없음 포함)', () => {
    expect(() => checkKoreanPoliteStyle('따뜻한 숨결이 문장을 데워요. 듣는 사람이 기대게 되죠! 이렇게 말하는 사람이 또 있을까요?')).not.toThrow()
    expect(() => checkKoreanPoliteStyle('목소리가 "괜찮아요"라고 말하는 것 같아요… 여운이 오래 남는 결이에요~ 마지막 문장은 마침표가 없어요')).not.toThrow()
    expect(() => checkKoreanPoliteStyle('맑은 소리가 이어져요.” 서두르지 않아도 충분해요.')).not.toThrow()
  })

  it('합니다체·해라체가 섞이면 몇 번째 문장인지만 담아 실패한다(본문은 싣지 않는다)', () => {
    const mixed = '목소리가 시원한 바람처럼 빠르게 흘러나옵니다. 말하는 동안 여유로움이 느껴져요. 은은한 밝기와 선명한 음색이 조화롭습니다.'
    expect(() => checkKoreanPoliteStyle(mixed)).toThrow('reading style: sentence 1 is not 해요체')
    expect(() => checkKoreanPoliteStyle('여운이 남아요. 리듬이 살아 있다.')).toThrow('reading style: sentence 2 is not 해요체')
    const error = (() => {
      try {
        checkKoreanPoliteStyle(mixed)
      } catch (cause) {
        return cause as Error
      }
    })()
    expect(error?.message).not.toContain('흘러나옵니다')
  })
})

describe('normalizeReadingOutput', () => {
  it('한국어 요청에만 해요체를 보고, 캡션(명사구)은 보지 않는다', () => {
    const mixed = { reading: '목소리가 시원한 바람처럼 흘러나옵니다. 말하는 동안 여유로움이 느껴져요. 듣는 사람이 따라가게 돼요.', caption: CAPTION }
    expect(() => normalizeReadingOutput(mixed, 'ko')).toThrow(/reading style/)
    expect(normalizeReadingOutput(mixed, 'en')).toEqual(mixed)
    const polite = { reading: '목소리가 시원한 바람처럼 흘러나와요. 말하는 동안 여유로움이 느껴져요. 듣는 사람이 따라가게 돼요.', caption: CAPTION }
    expect(normalizeReadingOutput(polite, 'ko')).toEqual(polite)
  })
})
