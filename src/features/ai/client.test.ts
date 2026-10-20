import { afterEach, describe, expect, it, vi } from 'vitest'
import { READING_CHAIN_BUDGET_MS, READING_CLIENT_TIMEOUT_MS } from '../../../shared/api'
import { fetchAiConfig, requestPortrait, requestReading, resetAiConfigCache, toReadingAxes } from './client'

function mockFetch(handler: (input: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(handler))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  resetAiConfigCache()
})

describe('fetchAiConfig', () => {
  it('설정을 한 번만 가져온다', async () => {
    const handler = vi.fn(() => Response.json({ provider: 'mock', features: { portrait: false } }))
    mockFetch(handler)
    await fetchAiConfig()
    await fetchAiConfig()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('실패하면 초상·리딩 기능이 꺼진 설정으로 본다', async () => {
    mockFetch(() => new Response('nope', { status: 500 }))
    expect(await fetchAiConfig()).toEqual({ provider: 'mock', textProviders: [], features: { portrait: false, reading: false } })
  })
})

const axes = { warmth: 0.8, density: 0.2, pace: 0.5, variation: 0.4, pitch: 0.3, brightness: 0.6 }

describe('toReadingAxes', () => {
  it('0..1로 자르고 소수 둘째 자리로 반올림하며, NaN 은 0.5', () => {
    expect(toReadingAxes({ ...axes, warmth: 0.123456, pitch: 1.2, brightness: -0.3, pace: Number.NaN })).toEqual({ warmth: 0.12, density: 0.2, pace: 0.5, variation: 0.4, pitch: 1, brightness: 0 })
  })
})

describe('requestReading', () => {
  it('타입 코드·축·언어만 보내고 리딩과 캡션을 돌려준다', async () => {
    let sentBody = ''
    mockFetch((_input, init) => {
      sentBody = String(init?.body)
      return Response.json({ reading: '  따뜻한 목소리예요.\n한 번 더.  ', caption: ' 한 줄  캡션 ', provider: 'claude' })
    })
    expect(await requestReading({ typeCode: 'WFQV', axes, locale: 'ko' })).toEqual({ locale: 'ko', reading: '따뜻한 목소리예요. 한 번 더.', caption: '한 줄 캡션' })
    expect(JSON.parse(sentBody)).toEqual({ typeCode: 'WFQV', axes, locale: 'ko' })
  })

  it('실패하거나 응답이 이상하면 null (결과 화면은 카탈로그 설명으로 폴백)', async () => {
    mockFetch(() => new Response('', { status: 503 }))
    expect(await requestReading({ typeCode: 'WFQV', axes, locale: 'en' })).toBeNull()
    mockFetch(() => Response.json({ reading: '', caption: 'x', provider: 'claude' }))
    expect(await requestReading({ typeCode: 'WFQV', axes, locale: 'en' })).toBeNull()
    mockFetch(() => Response.json({ reading: 'fine', caption: '', provider: 'claude' }))
    expect(await requestReading({ typeCode: 'WFQV', axes, locale: 'en' })).toBeNull()
    mockFetch(() => Response.json({ reading: 'x'.repeat(601), caption: 'ok', provider: 'claude' }))
    expect(await requestReading({ typeCode: 'WFQV', axes, locale: 'en' })).toBeNull()
    mockFetch(() => Response.json({ reading: 'fine', caption: 'c'.repeat(101), provider: 'claude' }))
    expect(await requestReading({ typeCode: 'WFQV', axes, locale: 'en' })).toBeNull()
    mockFetch(() => Response.json({ reading: 42, caption: ['x'], provider: 'claude' }))
    expect(await requestReading({ typeCode: 'WFQV', axes, locale: 'en' })).toBeNull()
  })

  it('서버 체인이 모두 실패해 mock 고정 문구가 오면 리딩 없음(null)으로 본다', async () => {
    mockFetch(() => Response.json({ reading: '설정된 텍스트 제공자가 없거나 모두 실패해 모의 고정 문구가 왔어요. 이 문장은 화면에 보이지 않아요.', caption: '모의 리딩', provider: 'mock' }))
    expect(await requestReading({ typeCode: 'WFQV', axes, locale: 'ko' })).toBeNull()
    mockFetch(() => Response.json({ reading: '맑고 가벼운 소리가 또박또박 이어져요. 서두르지 않는데도 지루할 틈이 없어요.', caption: '기대게 되는 목소리', provider: 'workers-ai' }))
    expect(await requestReading({ typeCode: 'WFQV', axes, locale: 'ko' })).toMatchObject({ locale: 'ko', caption: '기대게 되는 목소리' })
  })

  it('타임아웃이 지나면 요청을 끊고 null', async () => {
    vi.useFakeTimers()
    mockFetch((_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))))
    const pending = requestReading({ typeCode: 'WFQV', axes, locale: 'ko' })
    await vi.advanceTimersByTimeAsync(READING_CLIENT_TIMEOUT_MS + 1)
    expect(await pending).toBeNull()
  })

  it('Worker 체인 예산이 다 지나도 아직 기다린다(체인이 예산 끝에 보낸 답을 받는다)', async () => {
    vi.useFakeTimers()
    let respond: (response: Response) => void = () => undefined
    let signal: AbortSignal | undefined
    mockFetch((_input, init) => {
      signal = init?.signal ?? undefined
      return new Promise((resolve) => {
        respond = resolve
      })
    })
    const pending = requestReading({ typeCode: 'WFQV', axes, locale: 'ko' })
    await vi.advanceTimersByTimeAsync(READING_CHAIN_BUDGET_MS + 1)
    expect(signal?.aborted).toBe(false)
    respond(Response.json({ reading: '맑고 가벼운 소리가 또박또박 이어져요. 서두르지 않는데도 지루할 틈이 없어요.', caption: '기대게 되는 목소리', provider: 'claude' }))
    expect(await pending).toMatchObject({ locale: 'ko', caption: '기대게 되는 목소리' })
  })
})

describe('requestPortrait', () => {
  it('타입 코드와 씨앗만 보내고 data URL을 돌려준다', async () => {
    let sentBody = ''
    mockFetch((_input, init) => {
      sentBody = String(init?.body)
      return Response.json({ image: 'data:image/jpeg;base64,QUJD', provider: 'workers-ai' })
    })
    expect(await requestPortrait({ typeCode: 'WFQV', seed: 9 })).toBe('data:image/jpeg;base64,QUJD')
    expect(JSON.parse(sentBody)).toEqual({ typeCode: 'WFQV', seed: 9 })
  })

  it('실패하거나 이미지가 이상하면 null', async () => {
    mockFetch(() => new Response('', { status: 503 }))
    expect(await requestPortrait({ typeCode: 'WFQV', seed: 9 })).toBeNull()
    mockFetch(() => Response.json({ image: 'javascript:alert(1)', provider: 'mock' }))
    expect(await requestPortrait({ typeCode: 'WFQV', seed: 9 })).toBeNull()
    mockFetch(() => Response.json({ image: 'data:image/svg+xml;base64,QUJD', provider: 'mock' }))
    expect(await requestPortrait({ typeCode: 'WFQV', seed: 9 })).toBeNull()
    mockFetch(() => Response.json({ image: `data:image/png;base64,${'A'.repeat(5 * 1024 * 1024)}`, provider: 'mock' }))
    expect(await requestPortrait({ typeCode: 'WFQV', seed: 9 })).toBeNull()
  })

  it('이미 취소된 신호를 주면 취소된 채로 요청이 나가고 즉시 null로 끝난다', async () => {
    const handler = vi.fn((_input: string, init?: RequestInit) => {
      if (init?.signal?.aborted) return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      return Promise.resolve(Response.json({ image: null, provider: 'mock' }))
    })
    mockFetch(handler)
    const controller = new AbortController()
    controller.abort()
    expect(await requestPortrait({ typeCode: 'WFQV', seed: 9 }, controller.signal)).toBeNull()
    expect(handler).toHaveBeenCalledTimes(1)
    expect((handler.mock.calls[0]?.[1] as RequestInit | undefined)?.signal?.aborted).toBe(true)
  })

  it('타임아웃이 지나면 요청을 끊고 null', async () => {
    vi.useFakeTimers()
    mockFetch((_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))))
    const pending = requestPortrait({ typeCode: 'WFQV', seed: 9 })
    await vi.advanceTimersByTimeAsync(60_001)
    expect(await pending).toBeNull()
  })
})
