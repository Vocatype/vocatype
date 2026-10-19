import { describe, expect, it } from 'vitest'
import { ALL_TYPE_CODES } from './typeCode.ts'
import { buildPortraitPrompt, getCompatibility, getPersonalColor, getScent, getVoiceType, seasonFor, VOICE_TYPES } from './catalog.ts'

describe('catalog', () => {
  it('16개 타입이 모두 이름과 설명을 가진다', () => {
    expect(VOICE_TYPES).toHaveLength(16)
    for (const code of ALL_TYPE_CODES) {
      const type = getVoiceType(code)
      expect(type.name.ko.length, code).toBeGreaterThan(0)
      expect(type.name.en.length, code).toBeGreaterThan(0)
      expect(type.description.ko.length, code).toBeGreaterThan(10)
      expect(type.description.en.length, code).toBeGreaterThan(10)
    }
  })

  it('타입 이름이 겹치지 않는다', () => {
    const ko = new Set(VOICE_TYPES.map((type) => type.name.ko))
    const en = new Set(VOICE_TYPES.map((type) => type.name.en))
    expect(ko.size).toBe(16)
    expect(en.size).toBe(16)
  })

  it('퍼스널 컬러는 온도·밀도로 정해진다', () => {
    expect(seasonFor('WFQV')).toBe('autumn-warm')
    expect(seasonFor('WLQV')).toBe('spring-warm')
    expect(seasonFor('CFQV')).toBe('winter-cool')
    expect(seasonFor('CLQV')).toBe('summer-cool')
    for (const code of ALL_TYPE_CODES) expect(getPersonalColor(code).palette).toHaveLength(5)
  })

  it('향은 세 단계 노트와 이름을 가진다', () => {
    for (const code of ALL_TYPE_CODES) {
      const scent = getScent(code)
      expect(scent.top).toHaveLength(2)
      expect(scent.middle).toHaveLength(2)
      expect(scent.base).toHaveLength(2)
      expect(scent.name.ko).toContain(' · ')
    }
    expect(getScent('WFQV').base[0]?.en).toBe('Amber')
    expect(getScent('CLME').base[0]?.en).toBe('Cedarwood')
  })

  it('궁합은 밀도·속도를 뒤집고, 반대 타입은 네 축을 모두 뒤집는다', () => {
    const compatibility = getCompatibility('WFQV')
    expect(compatibility.best.code).toBe('WLMV')
    expect(compatibility.opposite.code).toBe('CLME')
    for (const code of ALL_TYPE_CODES) {
      expect(getCompatibility(code).best.code).not.toBe(code)
      expect(getCompatibility(getCompatibility(code).opposite.code).opposite.code).toBe(code)
    }
  })

  it('프롬프트는 성별·나이·인종을 지정하지 않는다', () => {
    for (const code of ALL_TYPE_CODES) {
      const prompt = buildPortraitPrompt(code).toLowerCase()
      for (const banned of ['woman', 'man ', 'male', 'female', 'asian', 'caucasian', 'black ', 'white person', 'young', 'old ']) {
        expect(prompt, `${code} contains ${banned}`).not.toContain(banned)
      }
      expect(prompt).toContain('photorealistic')
    }
  })
})
