import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEXT_MODEL } from './claude.ts'
import { buildTextChain, CHAIN_TIME_BUDGET_MS, createTextChain, parseTextProviderChain, resolveTextModel, selectTextChain } from './textChain.ts'
import type { TextProvider } from './types.ts'

const axes = { warmth: 0.8, density: 0.25, pace: 0.5, variation: 0.1, pitch: 0.4, brightness: 0.9 }
const input = { typeCode: 'WFQV', axes, locale: 'ko' } as const
const fakeAi = { run: async () => ({ response: '{}' }) } as unknown as Ai

describe('parseTextProviderChain', () => {
  it('콤마 목록을 순서대로 읽고 공백·중복·모르는 값·mock 을 뺀다', () => {
    expect(parseTextProviderChain('workers-ai,claude')).toEqual(['workers-ai', 'claude'])
    expect(parseTextProviderChain(' claude , workers-ai ')).toEqual(['claude', 'workers-ai'])
    expect(parseTextProviderChain('Workers-AI,Claude')).toEqual(['workers-ai', 'claude'])
    expect(parseTextProviderChain('workers-ai,workers-ai,claude')).toEqual(['workers-ai', 'claude'])
    expect(parseTextProviderChain('mock')).toEqual([])
    expect(parseTextProviderChain('openai,claude')).toEqual(['claude'])
    expect(parseTextProviderChain(undefined)).toEqual([])
    expect(parseTextProviderChain('')).toEqual([])
  })
})

describe('buildTextChain', () => {
  const names = (chain: TextProvider[]) => chain.map((p) => p.name)

  it('기본값(workers-ai)은 AI 바인딩만 있으면 키 없이 돈다', () => {
    expect(names(buildTextChain({ TEXT_PROVIDER: 'workers-ai', AI: fakeAi }))).toEqual(['workers-ai'])
  })

  it('키가 없거나 비어 있으면 claude 는 조용히 빠진다', () => {
    expect(names(buildTextChain({ TEXT_PROVIDER: 'workers-ai,claude', AI: fakeAi }))).toEqual(['workers-ai'])
    expect(names(buildTextChain({ TEXT_PROVIDER: 'workers-ai,claude', AI: fakeAi, ANTHROPIC_API_KEY: '  ' }))).toEqual(['workers-ai'])
  })

  it('바인딩이 없으면 workers-ai 가 빠진다', () => {
    expect(names(buildTextChain({ TEXT_PROVIDER: 'workers-ai,claude', ANTHROPIC_API_KEY: 'sk-ant-test' }))).toEqual(['claude'])
  })

  it('둘 다 있으면 목록 순서대로', () => {
    expect(names(buildTextChain({ TEXT_PROVIDER: 'workers-ai,claude', AI: fakeAi, ANTHROPIC_API_KEY: 'sk-ant-test' }))).toEqual(['workers-ai', 'claude'])
    expect(names(buildTextChain({ TEXT_PROVIDER: 'claude,workers-ai', AI: fakeAi, ANTHROPIC_API_KEY: 'sk-ant-test' }))).toEqual(['claude', 'workers-ai'])
  })

  it('아무것도 없으면 빈 체인이고 리딩 기능은 꺼진다', async () => {
    const chain = selectTextChain({})
    expect(chain.names).toEqual([])
    expect(chain.supportsReading).toBe(false)
    const result = await chain.generateReading(input)
    expect(result.provider).toBe('mock')
  })
})

describe('createTextChain', () => {
  const logger = () => ({ warn: vi.fn<(m: string) => void>(), error: vi.fn<(m: string) => void>() })
  const ok = (name: TextProvider['name'], reading: string): TextProvider => ({
    name,
    generateReading: vi.fn(async () => ({ reading, caption: `${name} caption` })),
  })
  const failing = (name: TextProvider['name'], error: Error): TextProvider => ({
    name,
    generateReading: vi.fn(async () => {
      throw error
    }),
  })
  const quota = Object.assign(new Error('4006: you have used up your daily free allocation of 10,000 neurons'), { name: 'AiError' })

  it('첫 제공자가 성공하면 두 번째는 부르지 않는다', async () => {
    const log = logger()
    const first = ok('workers-ai', 'free text')
    const second = ok('claude', 'paid text')
    const chain = createTextChain([first, second], { logger: log })
    expect(chain.names).toEqual(['workers-ai', 'claude'])
    expect(chain.supportsReading).toBe(true)
    await expect(chain.generateReading(input)).resolves.toEqual({ reading: 'free text', caption: 'workers-ai caption', provider: 'workers-ai' })
    expect(second.generateReading).not.toHaveBeenCalled()
    expect(log.warn).not.toHaveBeenCalled()
  })

  it('첫 제공자가 실패하면 두 번째를 쓰고 이유(오류 이름·메시지만)를 warn 로그에 남긴다', async () => {
    const log = logger()
    const chain = createTextChain([failing('workers-ai', quota), ok('claude', 'paid text')], { logger: log })
    const result = await chain.generateReading(input)
    expect(result.provider).toBe('claude')
    expect(result.reading).toBe('paid text')
    expect(log.warn).toHaveBeenCalledTimes(1)
    const message = log.warn.mock.calls[0]?.[0] ?? ''
    expect(message).toContain('[reading] workers-ai failed, falling back: AiError: 4006')
    expect(message).not.toContain('WFQV')
    expect(message).not.toContain('0.8')
    expect(log.error).not.toHaveBeenCalled()
  })

  it('JSON 파싱 실패 같은 형식 오류도 다음 제공자로 넘긴다', async () => {
    const log = logger()
    const chain = createTextChain([failing('workers-ai', new Error('response is not JSON')), ok('claude', 'paid text')], { logger: log })
    await expect(chain.generateReading(input)).resolves.toMatchObject({ provider: 'claude' })
    expect(log.warn.mock.calls[0]?.[0]).toContain('Error: response is not JSON')
  })

  it('모두 실패하면 mock 고정 문구를 돌려주고 error 로그를 남긴다', async () => {
    const log = logger()
    const chain = createTextChain([failing('workers-ai', quota), failing('claude', Object.assign(new Error('529 overloaded'), { name: 'InternalServerError' }))], { logger: log })
    const result = await chain.generateReading(input)
    expect(result.provider).toBe('mock')
    expect(result.reading).toContain('모의')
    expect(log.warn).toHaveBeenCalledTimes(2)
    expect(log.error).toHaveBeenCalledTimes(1)
    expect(log.error.mock.calls[0]?.[0]).toContain('all providers failed (workers-ai: AiError: 4006')
    expect(log.error.mock.calls[0]?.[0]).toContain('claude: InternalServerError: 529 overloaded')
  })

  it('시도하는 제공자에 남은 시간 예산을 신호로 넘긴다', async () => {
    const seen: (AbortSignal | undefined)[] = []
    const provider: TextProvider = {
      name: 'claude',
      generateReading: vi.fn(async (_input, options) => {
        seen.push(options?.signal)
        return { reading: 'paid text', caption: 'c' }
      }),
    }
    await createTextChain([provider], { logger: logger() }).generateReading(input)
    expect(seen[0]).toBeInstanceOf(AbortSignal)
    expect(seen[0]?.aborted).toBe(false)
  })

  it('앞 제공자가 시간 예산을 다 쓰면 남은 제공자는 건너뛰고 mock 으로 끝난다', async () => {
    const log = logger()
    let clock = 0
    const slow: TextProvider = {
      name: 'workers-ai',
      generateReading: vi.fn(async () => {
        clock += CHAIN_TIME_BUDGET_MS - 1000
        throw quota
      }),
    }
    const second = ok('claude', 'paid text')
    const result = await createTextChain([slow, second], { logger: log, now: () => clock }).generateReading(input)
    expect(result.provider).toBe('mock')
    expect(second.generateReading).not.toHaveBeenCalled()
    expect(log.warn.mock.calls[1]?.[0]).toContain('[reading] claude skipped: time budget exhausted')
    expect(log.error.mock.calls[0]?.[0]).toContain('claude: skipped, time budget exhausted')
  })

  it('빈 체인은 로그 없이 mock', async () => {
    const log = logger()
    const chain = createTextChain([], { logger: log })
    await expect(chain.generateReading({ ...input, locale: 'en' })).resolves.toMatchObject({ provider: 'mock' })
    expect(log.warn).not.toHaveBeenCalled()
    expect(log.error).not.toHaveBeenCalled()
  })
})

describe('resolveTextModel', () => {
  it('없으면 기본 모델, claude- 로 시작하는 식별자만 받는다', () => {
    expect(resolveTextModel(undefined)).toBe(DEFAULT_TEXT_MODEL)
    expect(resolveTextModel('claude-sonnet-5-5')).toBe('claude-sonnet-5-5')
    expect(resolveTextModel('gpt-4o')).toBe(DEFAULT_TEXT_MODEL)
    expect(resolveTextModel('')).toBe(DEFAULT_TEXT_MODEL)
  })
})
