import { describe, expect, it } from 'vitest'
import { parsePortraitRequest, validatePortraitBody } from './portrait.ts'

const axes = { warmth: 0.8, density: 0.2, pace: 0.5, variation: 0.4, pitch: 0.3, brightness: 0.6 }

describe('validatePortraitBody', () => {
  it('올바른 요청을 통과시킨다', () => {
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: 123, axes })).toEqual({ ok: true, value: { typeCode: 'WFQV', seed: 123, axes } })
  })

  it('잘못된 코드·씨앗을 거부한다', () => {
    expect(validatePortraitBody({ typeCode: 'XXXX', seed: 1, axes }).ok).toBe(false)
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: -1, axes }).ok).toBe(false)
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: 1.5, axes }).ok).toBe(false)
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: 2 ** 40, axes }).ok).toBe(false)
    expect(validatePortraitBody({ typeCode: 'WFQV', axes }).ok).toBe(false)
    expect(validatePortraitBody(null).ok).toBe(false)
    expect(validatePortraitBody('WFQV').ok).toBe(false)
  })

  it('여섯 축이 없거나 하나라도 빠지거나 0..1을 벗어나면 거부하고, 통과하면 소수 둘째 자리로 반올림한다(035)', () => {
    // 축이 없는 옛 클라이언트(배포 전에 열어 둔 탭) 요청.
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: 1 }).ok).toBe(false)
    const { pitch: _pitch, ...withoutPitch } = axes
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: 1, axes: withoutPitch }).ok).toBe(false)
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: 1, axes: { ...axes, pace: 1.2 } }).ok).toBe(false)
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: 1, axes: { ...axes, pace: '0.5' } }).ok).toBe(false)
    expect(validatePortraitBody({ typeCode: 'WFQV', seed: 1, axes: { ...axes, warmth: 0.8166, extra: 1 } })).toEqual({ ok: true, value: { typeCode: 'WFQV', seed: 1, axes: { ...axes, warmth: 0.82 } } })
  })

  it('추가 필드는 무시하고 필요한 것만 남긴다', () => {
    const result = validatePortraitBody({ typeCode: 'CLME', seed: 7, axes, prompt: 'ignored' })
    expect(result).toEqual({ ok: true, value: { typeCode: 'CLME', seed: 7, axes } })
  })
})

describe('parsePortraitRequest', () => {
  it('JSON이 아니면 invalid_request', async () => {
    const request = new Request('http://x/api/portrait', { method: 'POST', body: 'not json' })
    expect(await parsePortraitRequest(request)).toEqual({ ok: false, error: 'invalid_request' })
  })

  it('큰 본문은 too_large', async () => {
    const request = new Request('http://x/api/portrait', { method: 'POST', body: JSON.stringify({ typeCode: 'WFQV', seed: 1, axes, pad: 'x'.repeat(2000) }) })
    expect(await parsePortraitRequest(request)).toEqual({ ok: false, error: 'too_large' })
  })

  it('크기 제한은 바이트 기준이다 (한글은 글자당 3바이트)', async () => {
    const hangul = '가'.repeat(400) // 1200바이트, 400 코드 유닛
    const request = new Request('http://x/api/portrait', { method: 'POST', body: JSON.stringify({ typeCode: 'WFQV', seed: 1, axes, pad: hangul }) })
    expect(await parsePortraitRequest(request)).toEqual({ ok: false, error: 'too_large' })
  })

  it('작은 본문은 그대로 읽는다(가장 큰 정상 요청도 1KB 안)', async () => {
    const body = JSON.stringify({ typeCode: 'WFQV', seed: 4294967295, axes: { warmth: 0.88, density: 0.88, pace: 0.88, variation: 0.88, pitch: 0.88, brightness: 0.88 } })
    expect(new TextEncoder().encode(body).byteLength).toBeLessThan(1024)
    const request = new Request('http://x/api/portrait', { method: 'POST', body })
    expect((await parsePortraitRequest(request)).ok).toBe(true)
  })
})
