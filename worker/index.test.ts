import { describe, expect, it } from 'vitest'
import worker from './index.ts'

type FakeEnv = Env & { PORTRAIT_LIMITER?: { limit: (options: { key: string }) => Promise<{ success: boolean }> } }

const mockEnv = { AI_PROVIDER: 'mock' } as unknown as FakeEnv

type WorkerRequest = Parameters<typeof worker.fetch>[0]

function call(path: string, init?: RequestInit, env: FakeEnv = mockEnv) {
  return worker.fetch(new Request(`http://example.test${path}`, init) as unknown as WorkerRequest, env)
}

describe('worker routes', () => {
  it('health·config는 GET/HEAD만 받고 no-store로 응답한다', async () => {
    const config = await call('/api/config')
    expect(config.status).toBe(200)
    expect(config.headers.get('cache-control')).toBe('no-store')
    expect(await config.json()).toEqual({ provider: 'mock', features: { portrait: false } })
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
    const ai = { run: async () => ({ image: 'QUJD' }) } as unknown as Ai
    const env = { AI_PROVIDER: 'workers-ai', AI: ai } as unknown as FakeEnv
    expect(await (await call('/api/config', undefined, env)).json()).toEqual({ provider: 'workers-ai', features: { portrait: true } })
    const response = await call('/api/portrait', { method: 'POST', body: '{"typeCode":"CLME","seed":3}' }, env)
    expect(await response.json()).toEqual({ image: 'data:image/jpeg;base64,QUJD', provider: 'workers-ai' })
  })

  it('모르는 API 경로는 404', async () => {
    expect((await call('/api/nope')).status).toBe(404)
  })
})
