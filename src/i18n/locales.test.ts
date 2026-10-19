import { describe, expect, it } from 'vitest'
import { detectLocale } from './locales'

describe('detectLocale', () => {
  it('한국어 지역 코드가 붙어도 ko를 고른다', () => {
    expect(detectLocale(['ko-KR'])).toBe('ko')
    expect(detectLocale(['KO'])).toBe('ko')
  })

  it('선호 순서에서 먼저 나오는 지원 언어를 고른다', () => {
    expect(detectLocale(['en-US', 'ko-KR'])).toBe('en')
    expect(detectLocale(['ja-JP', 'ko-KR', 'en'])).toBe('ko')
  })

  it('지원하지 않는 언어만 있거나 비어 있으면 영어로 돌아간다', () => {
    expect(detectLocale(['ja-JP', 'fr'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})
