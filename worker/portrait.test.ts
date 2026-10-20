import { describe, expect, it } from 'vitest'
import { parsePortraitRequest, validatePortraitBody } from './portrait.ts'

describe('validatePortraitBody', () => {
  it('올바른 요청을 통과시킨다', () => {
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: 123 })).toEqual({ ok: true, value: { typeCode: 'WFQV', seed: 123 } })
  })

  it('잘못된 코드·씨앗을 거부한다', () => {
    expect(validatePortraitBody({ typeCode: 'XXXX', seed: 1 }).ok).toBe(false)
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: -1 }).ok).toBe(false)
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: 1.5 }).ok).toBe(false)
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: 2 ** 40 }).ok).toBe(false)
    expect(validatePortraitBody({ typeCode: 'WFQV' }).ok).toBe(false)
    expect(validatePortraitBody(null).ok).toBe(false)
    expect(validatePortraitBody('WFQV').ok).toBe(false)
  })

  it('추가 필드는 무시하고 필요한 것만 남긴다', () => {
    const result = validatePortraitBody({ typeCode: 'CLME', seed: 7, prompt: 'ignored' })
    expect(result).toEqual({ ok: true, value: { typeCode: 'CLME', seed: 7 } })
  })
})

describe('parsePortraitRequest', () => {
  it('JSON이 아니면 invalid_request', async () => {
    const request = new Request('http://x/api/portrait', { method: 'POST', body: 'not json' })
    expect(await parsePortraitRequest(request)).toEqual({ ok: false, error: 'invalid_request' })
  })

  it('큰 본문은 too_large', async () => {
    const request = new Request('http://x/api/portrait', { method: 'POST', body: JSON.stringify({ typeCode: 'WFQV', seed: 1, pad: 'x'.repeat(2000) }) })
    expect(await parsePortraitRequest(request)).toEqual({ ok: false, error: 'too_large' })
  })

  it('크기 제한은 바이트 기준이다 (한글은 글자당 3바이트)', async () => {
    const hangul = '가'.repeat(400) // 1200바이트, 400 코드 유닛
    const request = new Request('http://x/api/portrait', { method: 'POST', body: JSON.stringify({ typeCode: 'WFQV', seed: 1, pad: hangul }) })
    expect(await parsePortraitRequest(request)).toEqual({ ok: false, error: 'too_large' })
  })

  it('작은 본문은 그대로 읽는다', async () => {
    const request = new Request('http://x/api/portrait', { method: 'POST', body: '{"typeCode":"WFQV","seed":5}' })
    expect(await parsePortraitRequest(request)).toEqual({ ok: true, value: { typeCode: 'WFQV', seed: 5 } })
  })
})
