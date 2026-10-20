import { describe, expect, it } from 'vitest'
import { isLocale, LOCALES } from './locale.ts'

describe('isLocale', () => {
  it('지원 언어는 모두 받는다', () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true)
  })

  it('지원하지 않는 언어, 대소문자가 다른 값, 문자열이 아닌 값은 거부한다', () => {
    expect(isLocale('xx')).toBe(false)
    expect(isLocale('KO')).toBe(false)
    expect(isLocale('ko-KR')).toBe(false)
    expect(isLocale('')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
    expect(isLocale(null)).toBe(false)
    expect(isLocale(['ko'])).toBe(false)
  })
})
