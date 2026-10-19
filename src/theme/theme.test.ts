import { describe, expect, it } from 'vitest'
import { nextPreference, resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('system이면 시스템 설정을 따른다', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('명시 선택은 시스템 설정을 무시한다', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('nextPreference', () => {
  it('system → light → dark → system 순으로 순환한다', () => {
    expect(nextPreference('system')).toBe('light')
    expect(nextPreference('light')).toBe('dark')
    expect(nextPreference('dark')).toBe('system')
  })
})
