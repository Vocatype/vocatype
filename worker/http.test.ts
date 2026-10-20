import { describe, expect, it } from 'vitest'
import { readBodyLimited } from './http.ts'

/** 본문 스트림을 직접 넘기는 가짜 요청. content-length 없이 조각으로 오는(chunked) 본문을 흉내 낸다. */
function streamRequest(chunks: Uint8Array[], onCancel: () => void = () => undefined): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
    cancel: onCancel,
  })
  return { headers: new Headers(), body } as unknown as Request
}

describe('readBodyLimited', () => {
  it('제한 이하 본문은 UTF-8 문자열로 읽는다', async () => {
    const request = new Request('http://x/api', { method: 'POST', body: '{"a":"가나다"}' })
    expect(await readBodyLimited(request, 1024)).toBe('{"a":"가나다"}')
  })

  it('글자 수가 아니라 바이트로 센다(한글은 글자당 3바이트)', async () => {
    expect(await readBodyLimited(new Request('http://x/api', { method: 'POST', body: '가'.repeat(341) }), 1024)).toBe('가'.repeat(341)) // 1023바이트
    expect(await readBodyLimited(new Request('http://x/api', { method: 'POST', body: '가'.repeat(342) }), 1024)).toBeNull() // 1026바이트, 342 코드 유닛
  })

  it('본문이 없으면 빈 문자열', async () => {
    expect(await readBodyLimited(new Request('http://x/api', { method: 'POST' }), 1024)).toBe('')
  })

  it('선언된 content-length 가 제한을 넘으면 본문을 읽지 않고 null', async () => {
    const request = {
      headers: new Headers({ 'content-length': '2048' }),
      get body(): never {
        throw new Error('body must not be read')
      },
    } as unknown as Request
    expect(await readBodyLimited(request, 1024)).toBeNull()
  })

  it('길이 선언 없이 조각으로 와도 제한을 넘는 순간 스트림을 취소하고 null', async () => {
    let cancelled = false
    const request = streamRequest([new Uint8Array(600), new Uint8Array(600), new Uint8Array(600)], () => {
      cancelled = true
    })
    expect(await readBodyLimited(request, 1024)).toBeNull()
    expect(cancelled).toBe(true)
  })

  it('조각으로 온 본문을 이어 붙여 읽는다', async () => {
    const bytes = new TextEncoder().encode('{"typeCode":"WFQV"}')
    expect(await readBodyLimited(streamRequest([bytes.slice(0, 5), bytes.slice(5)]), 1024)).toBe('{"typeCode":"WFQV"}')
  })
})
