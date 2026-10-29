import type Anthropic from '@anthropic-ai/sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { READING_CHAIN_BUDGET_MS } from '../../shared/api.ts'
import { buildReadingParams, CONTRACT_RETRIES, createClaudeTextProvider, DEFAULT_TEXT_MODEL, isTextModel, MAX_RETRIES, parseReadingMessage, REQUEST_TIMEOUT_MS } from './claude.ts'
import { READING_SYSTEM_PROMPT } from './readingPrompt.ts'
import { FALLBACK_RESERVE_MS } from './textChain.ts'

const axes = { warmth: 0.8, density: 0.25, pace: 0.5, variation: 0.1, pitch: 0.4, brightness: 0.9 }
const input = { typeCode: 'WFQV', axes, locale: 'ko' } as const

const GOOD = {
  reading: '따뜻한 숨결이 문장을 데우고, 멈추는 자리마다 여운이 남아요. 빠르게 달리다가도 한 번씩 숨을 고르는 리듬이 있어요. 듣는 사람은 자기도 모르게 이야기 안으로 들어가게 돼요.',
  caption: '이야기 한가운데로 끌어들이는 목소리',
}

function message(content: Anthropic.ContentBlock[], overrides: Partial<Anthropic.Message> = {}): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content,
    stop_reason: 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 1200, output_tokens: 180 },
    ...overrides,
  } as unknown as Anthropic.Message
}

const text = (value: string): Anthropic.ContentBlock => ({ type: 'text', text: value, citations: null }) as Anthropic.TextBlock
const thinking = (): Anthropic.ContentBlock => ({ type: 'thinking', thinking: '', signature: 'sig' }) as Anthropic.ThinkingBlock

describe('buildReadingParams', () => {
  it('서버가 만든 프롬프트와 JSON 스키마, 낮은 effort 로 요청한다', () => {
    const params = buildReadingParams(input, DEFAULT_TEXT_MODEL)
    expect(params.model).toBe('claude-haiku-5-5')
    expect(params.system).toBe(READING_SYSTEM_PROMPT)
    expect(params.messages).toHaveLength(1)
    expect(params.messages[0]?.role).toBe('user')
    expect(String(params.messages[0]?.content)).toContain('- warmth: 0.80')
    expect(params.output_config?.format?.type).toBe('json_schema')
    expect(params.output_config?.effort).toBe('low')
    expect(params.max_tokens).toBeGreaterThanOrEqual(512)
    // 5.x 모델이 거부하는 프리필·샘플링 파라미터는 보내지 않는다.
    expect(params).not.toHaveProperty('temperature')
    expect(params).not.toHaveProperty('top_p')
  })
})

describe('parseReadingMessage', () => {
  it('thinking 블록 뒤의 텍스트에서 JSON 을 읽고 공백을 정리한다', () => {
    const result = parseReadingMessage(message([thinking(), text(JSON.stringify({ reading: `  ${GOOD.reading}\n\n`, caption: `${GOOD.caption}\n` }))]), 'ko')
    expect(result).toEqual(GOOD)
  })

  it('거부·잘림·형식 불일치·길이 초과는 예외', () => {
    expect(() => parseReadingMessage(message([], { stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'general_harms', explanation: null } as Anthropic.RefusalStopDetails }), 'ko')).toThrow(/refusal: general_harms/)
    expect(() => parseReadingMessage(message([text('{}')], { stop_reason: 'max_tokens' }), 'ko')).toThrow(/max_tokens/)
    expect(() => parseReadingMessage(message([text('not json')]), 'ko')).toThrow(/not JSON/)
    expect(() => parseReadingMessage(message([text('[1]')]), 'ko')).toThrow(/not an object/)
    expect(() => parseReadingMessage(message([text(JSON.stringify({ reading: '짧음', caption: GOOD.caption }))]), 'ko')).toThrow(/reading length/)
    expect(() => parseReadingMessage(message([text(JSON.stringify({ reading: 'x'.repeat(601), caption: GOOD.caption }))]), 'ko')).toThrow(/reading length/)
    expect(() => parseReadingMessage(message([text(JSON.stringify({ reading: GOOD.reading, caption: '' }))]), 'ko')).toThrow(/caption length/)
    expect(() => parseReadingMessage(message([text(JSON.stringify({ reading: GOOD.reading, caption: 'c'.repeat(101) }))]), 'ko')).toThrow(/caption length/)
    expect(() => parseReadingMessage(message([text(JSON.stringify({ reading: GOOD.reading }))]), 'ko')).toThrow(/caption length/)
  })
})

describe('createClaudeTextProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('주입한 createMessage 로 호출하고(전체 상한 신호 포함) 결과를 파싱한다', async () => {
    const calls: { params: Anthropic.MessageCreateParamsNonStreaming; signal: AbortSignal | undefined }[] = []
    const provider = createClaudeTextProvider({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-5-5',
      createMessage: async (params, options) => {
        calls.push({ params, signal: options?.signal })
        return message([text(JSON.stringify(GOOD))])
      },
    })
    expect(provider.name).toBe('claude')
    await expect(provider.generateReading(input)).resolves.toEqual(GOOD)
    expect(calls[0]?.params.model).toBe('claude-sonnet-5-5')
    // 재시도·retry-after 대기까지 합친 전체 상한. 클라이언트가 포기한 뒤 Worker 가 두 번째 호출을 보내지 않게 한다.
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal)
    expect(calls[0]?.signal?.aborted).toBe(false)
  })

  it('체인이 신호를 주지 않으면 체인 예산 전체를 자체 상한으로 걸고, 주면 그 신호를 그대로 쓴다', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const seen: (AbortSignal | undefined)[] = []
    const provider = createClaudeTextProvider({
      apiKey: 'sk-ant-test',
      createMessage: async (_params, options) => {
        seen.push(options?.signal)
        return message([text(JSON.stringify(GOOD))])
      },
    })
    await provider.generateReading(input)
    expect(timeout).toHaveBeenCalledExactlyOnceWith(READING_CHAIN_BUDGET_MS)
    expect(seen[0]).toBe(timeout.mock.results[0]?.value)
    timeout.mockClear()
    const chainSignal = new AbortController().signal
    await provider.generateReading(input, { signal: chainSignal })
    expect(timeout).not.toHaveBeenCalled()
    expect(seen[1]).toBe(chainSignal)
  })

  it('배분된 시간이 끝나 신호가 끊기면 SDK 의 중단 오류를 "time budget exceeded" 로 바꿔 던진다(체인 로그에서 구분되게)', async () => {
    const controller = new AbortController()
    const provider = createClaudeTextProvider({
      apiKey: 'sk-ant-test',
      createMessage: async () => {
        // SDK 는 중단을 APIUserAbortError 로만 알린다. 신호가 끊긴 뒤의 거부를 흉내 낸다.
        controller.abort()
        throw Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' })
      },
    })
    await expect(provider.generateReading(input, { signal: controller.signal })).rejects.toThrow('time budget exceeded (retries included)')
  })

  it('제공자 오류는 그대로 전파된다(라우트가 503으로 바꾼다)', async () => {
    const createMessage = vi.fn(async () => {
      throw new Error('overloaded')
    })
    const provider = createClaudeTextProvider({ apiKey: 'sk-ant-test', createMessage })
    await expect(provider.generateReading(input)).rejects.toThrow('overloaded')
    // 호출 오류는 SDK 가 이미 재시도했으므로 다시 부르지 않는다(계약 재호출은 답이 온 경우만).
    expect(createMessage).toHaveBeenCalledTimes(1)
  })

  it('출력이 계약에 맞지 않으면 체인으로 넘기기 전에 한 번 더 부르고, 그 답을 쓴다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const replies = [message([text(JSON.stringify({ reading: '짧음', caption: GOOD.caption }))]), message([text(JSON.stringify(GOOD))])]
    const createMessage = vi.fn(async (_params: Anthropic.MessageCreateParamsNonStreaming, _options?: { signal?: AbortSignal }) => replies.shift() as Anthropic.Message)
    const provider = createClaudeTextProvider({ apiKey: 'sk-ant-test', createMessage })
    const chainSignal = new AbortController().signal
    await expect(provider.generateReading(input, { signal: chainSignal })).resolves.toEqual(GOOD)
    expect(createMessage).toHaveBeenCalledTimes(2)
    // 다시 부를 때도 체인이 배분한 같은 신호를 쓴다(새 신호를 만들면 Workers AI 예비 몫과 체인 예산을 잠식한다).
    expect(createMessage.mock.calls[0]?.[1]?.signal).toBe(chainSignal)
    expect(createMessage.mock.calls[1]?.[1]?.signal).toBe(chainSignal)
    expect(String(warn.mock.calls[0]?.[0])).toContain('[reading] claude output rejected, retrying: reading length')
    // 로그에는 오류 메시지만 들어간다(응답 본문 없음).
    expect(String(warn.mock.calls[0]?.[0])).not.toContain('짧음')
  })

  it('한국어 리딩에 합니다체가 섞이면 계약 위반으로 보고 한 번 더 부른다(034)', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mixed = { reading: '목소리가 시원한 바람처럼 흘러나옵니다. 말하는 동안 숨을 고르는 여유가 느껴져요. 은은한 밝기와 선명한 음색이 조화롭습니다.', caption: GOOD.caption }
    const replies = [message([text(JSON.stringify(mixed))]), message([text(JSON.stringify(GOOD))])]
    const createMessage = vi.fn(async () => replies.shift() as Anthropic.Message)
    await expect(createClaudeTextProvider({ apiKey: 'sk-ant-test', createMessage }).generateReading(input)).resolves.toEqual(GOOD)
    expect(createMessage).toHaveBeenCalledTimes(2)
    expect(String(warn.mock.calls[0]?.[0])).toContain('reading style: sentence 1 ends in -다, not 해요체')
    // 영어 요청에는 해요체 검사를 하지 않는다.
    const english = { reading: 'Your voice moves like a cool breeze. It leaves room to breathe between phrases. Listeners lean in to follow it.', caption: 'A voice like morning air' }
    const once = vi.fn(async () => message([text(JSON.stringify(english))]))
    await expect(createClaudeTextProvider({ apiKey: 'sk-ant-test', createMessage: once }).generateReading({ ...input, locale: 'en' })).resolves.toEqual(english)
    expect(once).toHaveBeenCalledTimes(1)
  })

  it('다시 부르기는 CONTRACT_RETRIES 번까지이고, 그래도 맞지 않으면 체인으로 실패를 알린다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const createMessage = vi.fn(async () => message([text('not json')]))
    await expect(createClaudeTextProvider({ apiKey: 'sk-ant-test', createMessage }).generateReading(input)).rejects.toThrow(/not JSON/)
    expect(createMessage).toHaveBeenCalledTimes(1 + CONTRACT_RETRIES)
    // max_tokens 로 잘린 응답도 계약 위반으로 보고 다시 부른다.
    const truncated = vi.fn(async () => message([text('{')], { stop_reason: 'max_tokens' }))
    await expect(createClaudeTextProvider({ apiKey: 'sk-ant-test', createMessage: truncated }).generateReading(input)).rejects.toThrow(/max_tokens/)
    expect(truncated).toHaveBeenCalledTimes(1 + CONTRACT_RETRIES)
  })

  it('거부는 다시 부르지 않고, 배분된 시간이 끝났으면 다시 부르지 않는다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const refusal = vi.fn(async () => message([], { stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'general_harms', explanation: null } as Anthropic.RefusalStopDetails }))
    await expect(createClaudeTextProvider({ apiKey: 'sk-ant-test', createMessage: refusal }).generateReading(input)).rejects.toThrow(/refusal/)
    expect(refusal).toHaveBeenCalledTimes(1)
    const controller = new AbortController()
    const late = vi.fn(async () => {
      // 답은 왔지만 그 사이 배분된 시간이 끝난 상황.
      controller.abort()
      return message([text('not json')])
    })
    await expect(createClaudeTextProvider({ apiKey: 'sk-ant-test', createMessage: late }).generateReading(input, { signal: controller.signal })).rejects.toThrow(/not JSON/)
    expect(late).toHaveBeenCalledTimes(1)
  })
})

/**
 * SDK 기본 재시도 대기의 최댓값 합(밀리초). @anthropic-ai/sdk 0.135.0 `calculateDefaultRetryTimeoutMillis`:
 * n번째(0부터) 재시도 전에 min(0.5초 × 2^n, 8초)에 0.75~1을 곱한 만큼 기다린다. 서버가 retry-after 를 주면 그 값을 기다리고, 그때의 상한은 중단 신호다.
 */
function maxDefaultRetryDelaysMs(retries: number): number {
  let total = 0
  for (let n = 0; n < retries; n += 1) total += Math.min(500 * 2 ** n, 8000)
  return total
}

describe('Claude 시간 상수와 리딩 체인 예산', () => {
  it('예산 전부를 받을 때(체인 밖이거나 유일한 제공자) 요청 시간 × 시도 횟수와 재시도 대기가 체인 예산 안에 든다', () => {
    expect(maxDefaultRetryDelaysMs(1)).toBe(500)
    expect(maxDefaultRetryDelaysMs(2)).toBe(1500)
    expect(REQUEST_TIMEOUT_MS * (1 + MAX_RETRIES) + maxDefaultRetryDelaysMs(MAX_RETRIES)).toBeLessThanOrEqual(READING_CHAIN_BUDGET_MS)
  })

  it('뒤에 제공자가 있을 때(운영 순서 claude,workers-ai) 받은 몫(체인 예산 − 뒤 제공자 몫) 안에 요청 두 번과 첫 재시도 대기가 다 들어간다', () => {
    expect(MAX_RETRIES).toBeGreaterThanOrEqual(1)
    expect(REQUEST_TIMEOUT_MS * 2 + maxDefaultRetryDelaysMs(1)).toBeLessThanOrEqual(READING_CHAIN_BUDGET_MS - FALLBACK_RESERVE_MS)
  })
})

describe('isTextModel', () => {
  it('claude- 식별자만 통과한다', () => {
    expect(isTextModel('claude-haiku-5-5')).toBe(true)
    expect(isTextModel('claude-opus-4-1-20250805')).toBe(true)
    expect(isTextModel('Claude-haiku')).toBe(false)
    expect(isTextModel('claude-')).toBe(false)
    expect(isTextModel(42)).toBe(false)
  })
})
