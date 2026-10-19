import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAiConfig, requestPortrait, resetAiConfigCache } from './client'

function mockFetch(handler: (input: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(handler))
  vi.stubGlobal('window', { setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis) })
}

afterEach(() => {
  vi.unstubAllGlobals()
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

  it('실패하면 초상 기능이 꺼진 설정으로 본다', async () => {
    mockFetch(() => new Response('nope', { status: 500 }))
    expect(await fetchAiConfig()).toEqual({ provider: 'mock', features: { portrait: false } })
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
  })
})
