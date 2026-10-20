import { describe, expect, it } from 'vitest'
import { DEFAULT_TEXT_MODEL } from './claude.ts'
import { mockTextProvider } from './textMock.ts'
import { parseTextProviderName, resolveTextModel, selectTextProvider } from './textSelect.ts'

describe('selectTextProvider', () => {
  it('설정이 없거나 mock이면 모의 제공자', () => {
    expect(selectTextProvider({}).name).toBe('mock')
    expect(selectTextProvider({ TEXT_PROVIDER: 'mock' }).name).toBe('mock')
    expect(selectTextProvider({}).supportsReading).toBe(false)
  })

  it('claude 라도 키가 없거나 비어 있으면 모의 제공자', () => {
    expect(selectTextProvider({ TEXT_PROVIDER: 'claude' }).name).toBe('mock')
    expect(selectTextProvider({ TEXT_PROVIDER: 'claude', ANTHROPIC_API_KEY: '   ' }).name).toBe('mock')
  })

  it('claude + 키면 Claude 제공자', () => {
    const provider = selectTextProvider({ TEXT_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'sk-ant-test' })
    expect(provider.name).toBe('claude')
    expect(provider.supportsReading).toBe(true)
  })

  it('알 수 없는 값은 mock으로 해석한다', () => {
    expect(parseTextProviderName('openai')).toBe('mock')
    expect(parseTextProviderName(undefined)).toBe('mock')
    expect(parseTextProviderName('claude')).toBe('claude')
  })
})

describe('resolveTextModel', () => {
  it('없으면 기본 모델, claude- 로 시작하는 식별자만 받는다', () => {
    expect(resolveTextModel(undefined)).toBe(DEFAULT_TEXT_MODEL)
    expect(resolveTextModel('claude-sonnet-5-5')).toBe('claude-sonnet-5-5')
    expect(resolveTextModel('gpt-4o')).toBe(DEFAULT_TEXT_MODEL)
    expect(resolveTextModel('claude-haiku-5-5; drop')).toBe(DEFAULT_TEXT_MODEL)
    expect(resolveTextModel('')).toBe(DEFAULT_TEXT_MODEL)
  })
})

describe('mockTextProvider', () => {
  it('언어별 고정 문구를 돌려주고 클라이언트 호출 대상은 아니다', async () => {
    const axes = { warmth: 0.5, density: 0.5, pace: 0.5, variation: 0.5, pitch: 0.5, brightness: 0.5 }
    const ko = await mockTextProvider.generateReading({ typeCode: 'WFQV', axes, locale: 'ko' })
    const en = await mockTextProvider.generateReading({ typeCode: 'WFQV', axes, locale: 'en' })
    expect(ko.reading).toContain('모의')
    expect(en.reading).toContain('mock')
    expect(ko.caption.length).toBeGreaterThan(0)
    expect(mockTextProvider.supportsReading).toBe(false)
  })
})
