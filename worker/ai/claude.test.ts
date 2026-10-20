import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { buildReadingParams, createClaudeTextProvider, DEFAULT_TEXT_MODEL, isTextModel, parseReadingMessage } from './claude.ts'
import { READING_SYSTEM_PROMPT } from './readingPrompt.ts'

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
    const result = parseReadingMessage(message([thinking(), text(JSON.stringify({ reading: `  ${GOOD.reading}\n\n`, caption: `${GOOD.caption}\n` }))]))
    expect(result).toEqual(GOOD)
  })

  it('거부·잘림·형식 불일치·길이 초과는 예외', () => {
    expect(() => parseReadingMessage(message([], { stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'general_harms', explanation: null } as Anthropic.RefusalStopDetails }))).toThrow(/refusal: general_harms/)
    expect(() => parseReadingMessage(message([text('{}')], { stop_reason: 'max_tokens' }))).toThrow(/max_tokens/)
    expect(() => parseReadingMessage(message([text('not json')]))).toThrow(/not JSON/)
    expect(() => parseReadingMessage(message([text('[1]')]))).toThrow(/length/)
    expect(() => parseReadingMessage(message([text(JSON.stringify({ reading: '짧음', caption: GOOD.caption }))]))).toThrow(/reading length/)
    expect(() => parseReadingMessage(message([text(JSON.stringify({ reading: 'x'.repeat(601), caption: GOOD.caption }))]))).toThrow(/reading length/)
    expect(() => parseReadingMessage(message([text(JSON.stringify({ reading: GOOD.reading, caption: '' }))]))).toThrow(/caption length/)
    expect(() => parseReadingMessage(message([text(JSON.stringify({ reading: GOOD.reading, caption: 'c'.repeat(101) }))]))).toThrow(/caption length/)
    expect(() => parseReadingMessage(message([text(JSON.stringify({ reading: GOOD.reading }))]))).toThrow(/caption length/)
  })
})

describe('createClaudeTextProvider', () => {
  it('주입한 createMessage 로 호출하고 결과를 파싱한다', async () => {
    const calls: Anthropic.MessageCreateParamsNonStreaming[] = []
    const provider = createClaudeTextProvider({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-5-5',
      createMessage: async (params) => {
        calls.push(params)
        return message([text(JSON.stringify(GOOD))])
      },
    })
    expect(provider.name).toBe('claude')
    await expect(provider.generateReading(input)).resolves.toEqual(GOOD)
    expect(calls[0]?.model).toBe('claude-sonnet-5-5')
  })

  it('제공자 오류는 그대로 전파된다(라우트가 503으로 바꾼다)', async () => {
    const provider = createClaudeTextProvider({ apiKey: 'sk-ant-test', createMessage: async () => { throw new Error('overloaded') } })
    await expect(provider.generateReading(input)).rejects.toThrow('overloaded')
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
