import { describe, expect, it } from 'vitest'
import { wrapText } from './wrapText'

const measure = (s: string) => s.length * 10

describe('wrapText', () => {
  it('공백 단위로 줄을 나눈다', () => {
    expect(wrapText('aaa bbb ccc ddd', 75, measure)).toEqual(['aaa bbb', 'ccc ddd'])
  })

  it('폭을 넘는 단어는 글자 단위로 자른다', () => {
    expect(wrapText('abcdefghij', 45, measure)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('한국어 어절도 같은 규칙으로 나눈다', () => {
    expect(wrapText('따뜻하고 꽉 찬 목소리가 빠르게 굽이칩니다', 90, measure)).toEqual(['따뜻하고 꽉 찬', '목소리가 빠르게', '굽이칩니다'])
  })

  it('줄바꿈 문자는 문단을 나눈다', () => {
    expect(wrapText('a\n\nb', 100, measure)).toEqual(['a', '', 'b'])
  })
})
