import { describe, expect, it } from 'vitest'
import { ALL_TYPE_CODES } from '../../shared/typeCode.ts'
import { buildReadingUserMessage, READING_OUTPUT_SCHEMA, READING_SYSTEM_PROMPT } from './readingPrompt.ts'

const axes = { warmth: 0.8, density: 0.25, pace: 0.5, variation: 0.123, pitch: 0.4, brightness: 0.9 }

describe('READING_SYSTEM_PROMPT', () => {
  it('성별·나이·인종 추정과 진단을 금지하고 수치 인용을 막는다', () => {
    for (const word of ['gender', 'age', 'ethnicity', 'nationality', 'health', 'diagnose', 'numbers', 'type code']) {
      expect(READING_SYSTEM_PROMPT.toLowerCase()).toContain(word)
    }
    expect(READING_SYSTEM_PROMPT).toContain('3 to 4 sentences')
    expect(READING_SYSTEM_PROMPT).toContain('never the audio')
  })
})

describe('buildReadingUserMessage', () => {
  it('타입 이름·글자 뜻·여섯 축 수치·출력 언어만 담는다', () => {
    const ko = buildReadingUserMessage({ typeCode: 'WFQV', axes, locale: 'ko' })
    expect(ko).toContain('Output language: Korean')
    expect(ko).toContain('불꽃 이야기꾼 (The Fireside Storyteller)')
    expect(ko).toContain('Warm (temperature)')
    expect(ko).toContain('- warmth: 0.80')
    expect(ko).toContain('- variation: 0.12')
    expect(ko).not.toContain('WFQV')
    const en = buildReadingUserMessage({ typeCode: 'CLME', axes, locale: 'en' })
    expect(en).toContain('Output language: English')
    expect(en).toContain('The Frosty Morning Bookseller')
    expect(en).toContain('Cool (temperature)')
  })

  it('모든 타입·언어에서 만들어진다', () => {
    for (const code of ALL_TYPE_CODES) {
      for (const locale of ['ko', 'en'] as const) {
        expect(buildReadingUserMessage({ typeCode: code, axes, locale }).length).toBeGreaterThan(100)
      }
    }
  })
})

describe('READING_OUTPUT_SCHEMA', () => {
  it('reading 과 caption 문자열만 허용한다', () => {
    expect(READING_OUTPUT_SCHEMA.required).toEqual(['reading', 'caption'])
    expect(READING_OUTPUT_SCHEMA.additionalProperties).toBe(false)
  })
})
