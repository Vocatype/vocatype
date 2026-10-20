import { afterEach, describe, expect, it, vi } from 'vitest'
import { READING_OUTPUT_SCHEMA, READING_SYSTEM_PROMPT } from './readingPrompt.ts'
import { buildWorkersAiTextInput, createWorkersAiTextProvider, parseWorkersAiTextResult, WORKERS_AI_TEXT_MODEL } from './workersAiText.ts'

const axes = { warmth: 0.8, density: 0.25, pace: 0.5, variation: 0.1, pitch: 0.4, brightness: 0.9 }
const input = { typeCode: 'WFQV', axes, locale: 'ko' } as const
const GOOD = {
  reading: '따뜻한 숨결이 문장을 데우고, 멈추는 자리마다 여운이 남아요. 빠르게 달리다가도 한 번씩 숨을 고르는 리듬이 있어요. 듣는 사람은 자기도 모르게 이야기 안으로 들어가게 돼요.',
  caption: '이야기 한가운데로 끌어들이는 목소리',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildWorkersAiTextInput', () => {
  it('Claude 와 같은 프롬프트를 messages 로, 같은 스키마를 JSON 모드로 보낸다', () => {
    const built = buildWorkersAiTextInput(input) as { messages: { role: string; content: string }[]; max_tokens: number; response_format: { type: string; json_schema: unknown } }
    expect(built.messages[0]).toEqual({ role: 'system', content: READING_SYSTEM_PROMPT })
    expect(built.messages[1]?.role).toBe('user')
    expect(built.messages[1]?.content).toContain('- warmth: 0.80')
    expect(built.messages[1]?.content).toContain('Output language: Korean')
    expect(built.response_format).toEqual({ type: 'json_schema', json_schema: READING_OUTPUT_SCHEMA })
    expect(built.max_tokens).toBe(1024)
  })
})

describe('parseWorkersAiTextResult', () => {
  it('문자열 JSON, 코드 펜스로 감싼 JSON, 이미 파싱된 객체를 모두 받는다', () => {
    expect(parseWorkersAiTextResult({ response: JSON.stringify(GOOD) })).toEqual(GOOD)
    expect(parseWorkersAiTextResult({ response: '```json\n' + JSON.stringify(GOOD) + '\n```' })).toEqual(GOOD)
    expect(parseWorkersAiTextResult({ response: { ...GOOD, caption: `  ${GOOD.caption}\n` } })).toEqual(GOOD)
  })

  it('형식이 어긋나면 예외(체인이 다음 제공자로 넘긴다)', () => {
    expect(() => parseWorkersAiTextResult({ response: 'Sure! Here is your reading: ...' })).toThrow(/not JSON/)
    expect(() => parseWorkersAiTextResult({ response: JSON.stringify({ reading: '짧음', caption: 'x' }) })).toThrow(/reading length/)
    expect(() => parseWorkersAiTextResult({ response: JSON.stringify([GOOD]) })).toThrow(/not an object/)
    expect(() => parseWorkersAiTextResult({})).toThrow(/empty response/)
    expect(() => parseWorkersAiTextResult(null)).toThrow(/empty response/)
    // 생성 타입상 출력이 문자열일 수도 있다(스트림이 아니면 실제로 오지 않지만 방어).
    expect(() => parseWorkersAiTextResult('plain string output')).toThrow(/empty response/)
  })
})

describe('createWorkersAiTextProvider', () => {
  it('모델 상수와 만든 입력으로 ai.run 을 부르고 결과를 검증한다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const calls: unknown[] = []
    const ai = {
      run: async (model: string, built: unknown) => {
        calls.push([model, built])
        return { response: JSON.stringify(GOOD), usage: { prompt_tokens: 900, completion_tokens: 150 } }
      },
    } as unknown as Ai
    const provider = createWorkersAiTextProvider(ai)
    expect(provider.name).toBe('workers-ai')
    await expect(provider.generateReading(input)).resolves.toEqual(GOOD)
    expect(calls[0]?.[0 as never]).toBe(WORKERS_AI_TEXT_MODEL)
    expect((calls[0] as [string, { response_format: { type: string } }])[1].response_format.type).toBe('json_schema')
  })

  it('할당량 소진 등 바인딩 오류는 그대로 전파된다', async () => {
    const quota = Object.assign(new Error('4006: you have used up your daily free allocation of 10,000 neurons'), { name: 'AiError' })
    const provider = createWorkersAiTextProvider({ run: async () => { throw quota } } as unknown as Ai)
    await expect(provider.generateReading(input)).rejects.toBe(quota)
  })
})
