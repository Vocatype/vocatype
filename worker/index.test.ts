import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index.ts'

type FakeLimiter = { limit: (options: { key: string }) => Promise<{ success: boolean }> }
type FakeEnv = Env & { PORTRAIT_LIMITER?: FakeLimiter; READING_LIMITER?: FakeLimiter }

const mockEnv = { AI_PROVIDER: 'mock', TEXT_PROVIDER: 'mock' } as unknown as FakeEnv
const claudeEnv = { AI_PROVIDER: 'mock', TEXT_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'sk-ant-test-key' } as unknown as FakeEnv

const axes = { warmth: 0.8, density: 0.2, pace: 0.5, variation: 0.4, pitch: 0.3, brightness: 0.6 }
const readingBody = JSON.stringify({ typeCode: 'WFQV', axes, locale: 'ko' })

type WorkerRequest = Parameters<typeof worker.fetch>[0]

function call(path: string, init?: RequestInit, env: FakeEnv = mockEnv) {
  return worker.fetch(new Request(`http://example.test${path}`, init) as unknown as WorkerRequest, env)
}

/** Anthropic API 응답 흉내. SDK 는 전역 fetch 를 쓰므로 그것만 바꾸면 네트워크 없이 끝까지 돈다. */
function anthropicMessage(reading: string, caption: string) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [{ type: 'text', text: JSON.stringify({ reading, caption }), citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 500, output_tokens: 120 },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('worker routes', () => {
  it('health·config는 GET/HEAD만 받고 no-store로 응답한다', async () => {
    const config = await call('/api/config')
    expect(config.status).toBe(200)
    expect(config.headers.get('cache-control')).toBe('no-store')
    expect(await config.json()).toEqual({ provider: 'mock', textProviders: [], features: { portrait: false, reading: false } })
    expect((await call('/api/config', { method: 'HEAD' })).status).toBe(200)
    const wrong = await call('/api/config', { method: 'POST' })
    expect(wrong.status).toBe(405)
    expect(wrong.headers.get('allow')).toBe('GET, HEAD')
    expect((await call('/api/health')).status).toBe(200)
  })

  it('portrait: mock은 image null, 잘못된 요청은 400, 큰 본문은 413, GET은 405', async () => {
    const ok = await call('/api/portrait', { method: 'POST', body: JSON.stringify({ typeCode: 'WFQV', seed: 7 }) })
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ image: null, provider: 'mock' })
    expect((await call('/api/portrait', { method: 'POST', body: '{"typeCode":"ZZZZ","seed":1}' })).status).toBe(400)
    expect((await call('/api/portrait', { method: 'POST', body: JSON.stringify({ typeCode: 'WFQV', seed: 1, pad: 'x'.repeat(2000) }) })).status).toBe(413)
    const get = await call('/api/portrait')
    expect(get.status).toBe(405)
    expect(get.headers.get('allow')).toBe('POST')
  })

  it('다른 사이트에서 온 요청은 403, 속도 제한에 걸리면 429', async () => {
    const cross = await call('/api/portrait', { method: 'POST', body: '{"typeCode":"WFQV","seed":1}', headers: { 'sec-fetch-site': 'cross-site' } })
    expect(cross.status).toBe(403)
    const limited = await call('/api/portrait', { method: 'POST', body: '{"typeCode":"WFQV","seed":1}' }, {
      ...mockEnv,
      PORTRAIT_LIMITER: { limit: async () => ({ success: false }) },
    })
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('60')
    const allowed = await call('/api/portrait', { method: 'POST', body: '{"typeCode":"WFQV","seed":1}' }, {
      ...mockEnv,
      PORTRAIT_LIMITER: { limit: async () => ({ success: true }) },
    })
    expect(allowed.status).toBe(200)
  })

  it('제공자가 실패하면 503이고 세부 내용은 숨긴다', async () => {
    const failingAi = { run: async () => { throw new Error('upstream exploded') } } as unknown as Ai
    const env = { AI_PROVIDER: 'workers-ai', AI: failingAi } as unknown as FakeEnv
    const response = await call('/api/portrait', { method: 'POST', body: '{"typeCode":"WFQV","seed":1}' }, env)
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('exploded')
  })

  it('workers-ai 제공자는 data URL을 돌려준다', async () => {
    const ai = { run: async () => ({ image: '/9j/QUJD' }) } as unknown as Ai
    const env = { AI_PROVIDER: 'workers-ai', AI: ai } as unknown as FakeEnv
    expect(await (await call('/api/config', undefined, env)).json()).toEqual({ provider: 'workers-ai', textProviders: [], features: { portrait: true, reading: false } })
    const response = await call('/api/portrait', { method: 'POST', body: '{"typeCode":"CLME","seed":3}' }, env)
    expect(await response.json()).toEqual({ image: 'data:image/jpeg;base64,/9j/QUJD', provider: 'workers-ai' })
  })

  it('모르는 API 경로는 404', async () => {
    expect((await call('/api/nope')).status).toBe(404)
  })
})

describe('POST /api/reading', () => {
  it('mock은 고정 문구 200, 잘못된 요청은 400, 큰 본문은 413, GET은 405', async () => {
    const ok = await call('/api/reading', { method: 'POST', body: readingBody })
    expect(ok.status).toBe(200)
    expect(ok.headers.get('cache-control')).toBe('no-store')
    const body = (await ok.json()) as { reading: string; caption: string; provider: string }
    expect(body.provider).toBe('mock')
    expect(body.reading.length).toBeGreaterThan(20)
    expect(body.caption.length).toBeGreaterThan(0)
    expect((await call('/api/reading', { method: 'POST', body: JSON.stringify({ typeCode: 'ZZZZ', axes, locale: 'ko' }) })).status).toBe(400)
    expect((await call('/api/reading', { method: 'POST', body: JSON.stringify({ typeCode: 'WFQV', axes: { ...axes, pace: 2 }, locale: 'ko' }) })).status).toBe(400)
    expect((await call('/api/reading', { method: 'POST', body: JSON.stringify({ typeCode: 'WFQV', axes, locale: 'ko', pad: 'x'.repeat(2000) }) })).status).toBe(413)
    const get = await call('/api/reading')
    expect(get.status).toBe(405)
    expect(get.headers.get('allow')).toBe('POST')
  })

  it('다른 사이트에서 온 요청은 403, 리딩 속도 제한에 걸리면 429 (초상 제한과 별개)', async () => {
    const cross = await call('/api/reading', { method: 'POST', body: readingBody, headers: { 'sec-fetch-site': 'cross-site' } })
    expect(cross.status).toBe(403)
    const limited = await call('/api/reading', { method: 'POST', body: readingBody }, { ...mockEnv, READING_LIMITER: { limit: async () => ({ success: false }) } })
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('60')
    // 초상 제한만 걸린 상태에서는 리딩이 막히지 않는다.
    const portraitOnly = await call('/api/reading', { method: 'POST', body: readingBody }, {
      ...mockEnv,
      PORTRAIT_LIMITER: { limit: async () => ({ success: false }) },
      READING_LIMITER: { limit: async () => ({ success: true }) },
    })
    expect(portraitOnly.status).toBe(200)
  })

  it('claude 제공자는 SDK로 Anthropic을 부르고, 보내는 것은 타입·축·언어가 담긴 프롬프트뿐이다', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(anthropicMessage('따뜻한 숨결이 문장을 데우고, 멈추는 자리마다 여운이 남아요. 빠르게 달리다가도 한 번씩 숨을 고르는 리듬이 있어요. 듣는 사람은 자기도 모르게 이야기 안으로 들어가게 돼요.', '이야기 한가운데로 끌어들이는 목소리')))
    vi.stubGlobal('fetch', fetchMock)
    const config = await call('/api/config', undefined, claudeEnv)
    expect(await config.json()).toEqual({ provider: 'mock', textProviders: ['claude'], features: { portrait: false, reading: true } })
    const response = await call('/api/reading', { method: 'POST', body: readingBody, headers: { 'cf-connecting-ip': '203.0.113.9', 'user-agent': 'TestBrowser' } }, claudeEnv)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      reading: '따뜻한 숨결이 문장을 데우고, 멈추는 자리마다 여운이 남아요. 빠르게 달리다가도 한 번씩 숨을 고르는 리듬이 있어요. 듣는 사람은 자기도 모르게 이야기 안으로 들어가게 돼요.',
      caption: '이야기 한가운데로 끌어들이는 목소리',
      provider: 'claude',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('https://api.anthropic.com/v1/messages')
    const headers = new Headers(init?.headers as HeadersInit)
    expect(headers.get('x-api-key')).toBe('sk-ant-test-key')
    const sent = JSON.parse(String(init?.body)) as { model: string; system: string; messages: { content: string }[]; output_config: { format: { type: string } } }
    expect(sent.model).toBe('claude-haiku-5-5')
    expect(sent.output_config.format.type).toBe('json_schema')
    expect(sent.messages[0]?.content).toContain('- warmth: 0.80')
    expect(sent.messages[0]?.content).toContain('Output language: Korean')
    // 사용자 IP·UA·녹음 정보는 프롬프트 어디에도 없다.
    const raw = String(init?.body)
    expect(raw).not.toContain('203.0.113.9')
    expect(raw).not.toContain('TestBrowser')
    expect(raw).not.toContain('seed')
    expect(sent).not.toHaveProperty('metadata')
  })

  it('claude 제공자가 실패하거나 거부하면 체인 끝의 mock 고정 문구(200, provider mock)로 답하고 세부 내용은 로그에만 남긴다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ type: 'error', error: { type: 'invalid_request_error', message: 'boom-detail' } }, { status: 400 })))
    const failed = await call('/api/reading', { method: 'POST', body: readingBody }, claudeEnv)
    expect(failed.status).toBe(200)
    const failedBody = (await failed.json()) as { provider: string; reading: string }
    expect(failedBody.provider).toBe('mock')
    expect(JSON.stringify(failedBody)).not.toContain('boom-detail')
    expect(warn.mock.calls[0]?.[0]).toContain('[reading] claude failed, falling back:')
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...anthropicMessage('x', 'y'), content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'general_harms', explanation: null } })))
    const refused = await call('/api/reading', { method: 'POST', body: readingBody }, claudeEnv)
    expect(refused.status).toBe(200)
    expect(((await refused.json()) as { provider: string }).provider).toBe('mock')
    expect(String(warn.mock.calls[1]?.[0])).toContain('refusal: general_harms')
  })

  it('체인: workers-ai 가 할당량 소진(4006)으로 실패하면 claude 가 답하고 provider 에 그 이름이 실린다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const quota = Object.assign(new Error('4006: you have used up your daily free allocation of 10,000 neurons'), { name: 'AiError' })
    const ai = { run: async () => { throw quota } } as unknown as Ai
    const fetchMock = vi.fn(async () => Response.json(anthropicMessage('따뜻한 숨결이 문장을 데우고, 멈추는 자리마다 여운이 남아요. 빠르게 달리다가도 한 번씩 숨을 고르는 리듬이 있어요.', '이야기 한가운데로 끌어들이는 목소리')))
    vi.stubGlobal('fetch', fetchMock)
    const env = { AI_PROVIDER: 'mock', TEXT_PROVIDER: 'workers-ai,claude', AI: ai, ANTHROPIC_API_KEY: 'sk-ant-test-key' } as unknown as FakeEnv
    expect(await (await call('/api/config', undefined, env)).json()).toEqual({ provider: 'mock', textProviders: ['workers-ai', 'claude'], features: { portrait: false, reading: true } })
    const response = await call('/api/reading', { method: 'POST', body: readingBody }, env)
    expect(response.status).toBe(200)
    expect(((await response.json()) as { provider: string }).provider).toBe('claude')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('[reading] workers-ai failed, falling back: AiError: 4006')
  })

  it('체인: workers-ai 가 성공하면 claude 는 부르지 않는다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const runs: unknown[] = []
    const ai = {
      run: async (model: string, built: unknown) => {
        runs.push([model, built])
        return { response: JSON.stringify({ reading: '맑고 가벼운 소리가 또박또박 이어져요. 서두르지 않는데도 지루할 틈이 없어요. 듣는 사람이 편하게 기대게 되는 결이에요.', caption: '편하게 기대게 되는 목소리' }) }
      },
    } as unknown as Ai
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const env = { AI_PROVIDER: 'mock', TEXT_PROVIDER: 'workers-ai,claude', AI: ai, ANTHROPIC_API_KEY: 'sk-ant-test-key' } as unknown as FakeEnv
    const response = await call('/api/reading', { method: 'POST', body: readingBody }, env)
    expect(await response.json()).toEqual({ reading: '맑고 가벼운 소리가 또박또박 이어져요. 서두르지 않는데도 지루할 틈이 없어요. 듣는 사람이 편하게 기대게 되는 결이에요.', caption: '편하게 기대게 되는 목소리', provider: 'workers-ai' })
    expect(fetchMock).not.toHaveBeenCalled()
    const [model, built] = runs[0] as [string, { messages: { role: string }[]; response_format: { type: string } }]
    expect(model).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast')
    expect(built.messages.map((m) => m.role)).toEqual(['system', 'user'])
    expect(built.response_format.type).toBe('json_schema')
  })

  it('체인: 모두 실패하면 200 + provider mock, error 로그 한 줄', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const ai = { run: async () => { throw new Error('upstream exploded') } } as unknown as Ai
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, { status: 529 })))
    const env = { AI_PROVIDER: 'mock', TEXT_PROVIDER: 'workers-ai,claude', AI: ai, ANTHROPIC_API_KEY: 'sk-ant-test-key' } as unknown as FakeEnv
    const response = await call('/api/reading', { method: 'POST', body: readingBody }, env)
    expect(response.status).toBe(200)
    expect(((await response.json()) as { provider: string }).provider).toBe('mock')
    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0]?.[0])).toContain('all providers failed')
  })

  it('TEXT_PROVIDER=claude 라도 키가 없으면 체인이 비어 리딩이 꺼진다', async () => {
    const env = { AI_PROVIDER: 'mock', TEXT_PROVIDER: 'claude' } as unknown as FakeEnv
    expect(await (await call('/api/config', undefined, env)).json()).toEqual({ provider: 'mock', textProviders: [], features: { portrait: false, reading: false } })
  })
})
