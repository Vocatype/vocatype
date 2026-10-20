import { describe, expect, it } from 'vitest'
import { parseReadingRequest, validateReadingBody } from './reading.ts'

const axes = { warmth: 0.8, density: 0.2, pace: 0.5, variation: 0.4, pitch: 0.3, brightness: 0.6 }

describe('validateReadingBody', () => {
  it('올바른 요청을 통과시키고 축을 소수 둘째 자리로 반올림한다', () => {
    expect(validateReadingBody({ typeCode: 'WFQV', axes, locale: 'ko' })).toEqual({ ok: true, value: { typeCode: 'WFQV', axes, locale: 'ko' } })
    const rounded = validateReadingBody({ typeCode: 'CLME', axes: { ...axes, warmth: 0.123456, pitch: 0.995 }, locale: 'en' })
    expect(rounded.ok && rounded.value.axes.warmth).toBe(0.12)
    expect(rounded.ok && rounded.value.axes.pitch).toBe(1)
    expect(validateReadingBody({ typeCode: 'WFQV', axes: { ...axes, warmth: 0, pitch: 1 }, locale: 'en' }).ok).toBe(true)
  })

  it('잘못된 코드·로케일·축을 거부한다', () => {
    expect(validateReadingBody({ typeCode: 'XXXX', axes, locale: 'ko' }).ok).toBe(false)
    expect(validateReadingBody({ typeCode: 'WFQV', axes, locale: 'ja' }).ok).toBe(false)
    expect(validateReadingBody({ typeCode: 'WFQV', axes }).ok).toBe(false)
    expect(validateReadingBody({ typeCode: 'WFQV', locale: 'ko' }).ok).toBe(false)
    expect(validateReadingBody({ typeCode: 'WFQV', axes: { ...axes, warmth: 1.01 }, locale: 'ko' }).ok).toBe(false)
    expect(validateReadingBody({ typeCode: 'WFQV', axes: { ...axes, warmth: -0.01 }, locale: 'ko' }).ok).toBe(false)
    expect(validateReadingBody({ typeCode: 'WFQV', axes: { ...axes, warmth: Number.NaN }, locale: 'ko' }).ok).toBe(false)
    expect(validateReadingBody({ typeCode: 'WFQV', axes: { ...axes, warmth: '0.5' }, locale: 'ko' }).ok).toBe(false)
    const { brightness: _dropped, ...missing } = axes
    void _dropped
    expect(validateReadingBody({ typeCode: 'WFQV', axes: missing, locale: 'ko' }).ok).toBe(false)
    expect(validateReadingBody(null).ok).toBe(false)
    expect(validateReadingBody('WFQV').ok).toBe(false)
  })

  it('추가 필드는 무시하고 필요한 것만 남긴다', () => {
    const result = validateReadingBody({ typeCode: 'CLME', axes: { ...axes, extra: 9 }, locale: 'en', prompt: 'ignored', durationMs: 12000 })
    expect(result).toEqual({ ok: true, value: { typeCode: 'CLME', axes, locale: 'en' } })
  })
})

describe('parseReadingRequest', () => {
  it('JSON 이 아니면 invalid_request, 1KB 를 넘으면 too_large', async () => {
    expect(await parseReadingRequest(new Request('http://x/api/reading', { method: 'POST', body: 'not json' }))).toEqual({ ok: false, error: 'invalid_request' })
    const big = JSON.stringify({ typeCode: 'WFQV', axes, locale: 'ko', pad: '가'.repeat(400) })
    expect(await parseReadingRequest(new Request('http://x/api/reading', { method: 'POST', body: big }))).toEqual({ ok: false, error: 'too_large' })
  })

  it('작은 본문은 그대로 읽는다', async () => {
    const request = new Request('http://x/api/reading', { method: 'POST', body: JSON.stringify({ typeCode: 'WFQV', axes, locale: 'en' }) })
    expect(await parseReadingRequest(request)).toEqual({ ok: true, value: { typeCode: 'WFQV', axes, locale: 'en' } })
  })
})
