import { describe, expect, it } from 'vitest'
import { mockProvider } from './mock.ts'
import { parseProviderName, selectProvider } from './select.ts'

describe('selectProvider', () => {
  it('설정이 없으면 mock', () => {
    expect(selectProvider({}).name).toBe('mock')
    expect(selectProvider({ AI_PROVIDER: 'mock' }).name).toBe('mock')
  })

  it('workers-ai 라도 바인딩이 없으면 mock', () => {
    expect(selectProvider({ AI_PROVIDER: 'workers-ai' }).name).toBe('mock')
  })

  it('workers-ai + 바인딩이면 Workers AI', () => {
    const fakeAi = { run: async () => ({ image: 'abc' }) } as unknown as Ai
    const provider = selectProvider({ AI_PROVIDER: 'workers-ai', AI: fakeAi })
    expect(provider.name).toBe('workers-ai')
    expect(provider.supportsPortrait).toBe(true)
  })

  it('알 수 없는 값은 mock으로 해석한다', () => {
    expect(parseProviderName('openai')).toBe('mock')
    expect(parseProviderName(undefined)).toBe('mock')
  })
})

describe('mockProvider', () => {
  it('이미지를 만들지 않는다', async () => {
    expect(mockProvider.supportsPortrait).toBe(false)
    await expect(mockProvider.generatePortrait({ prompt: 'x', seed: 1 })).resolves.toEqual({ image: null })
  })
})
