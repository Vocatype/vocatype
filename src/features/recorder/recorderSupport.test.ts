import { describe, expect, it } from 'vitest'
import { formatDuration, levelFromSamples, mapRecorderError, pickMimeType } from './recorderSupport'

describe('pickMimeType', () => {
  it('지원하는 첫 후보를 고른다', () => {
    expect(pickMimeType((type) => type === 'audio/mp4')).toBe('audio/mp4')
    expect(pickMimeType(() => true)).toBe('audio/webm;codecs=opus')
  })

  it('지원 확인이 예외를 던져도 다음 후보로 넘어간다', () => {
    expect(
      pickMimeType((type) => {
        if (type.startsWith('audio/webm')) throw new Error('nope')
        return type === 'audio/mp4'
      }),
    ).toBe('audio/mp4')
  })

  it('아무것도 지원하지 않으면 빈 문자열', () => {
    expect(pickMimeType(() => false)).toBe('')
  })
})

describe('mapRecorderError', () => {
  const named = (name: string) => Object.assign(new Error('x'), { name })

  it('권한·장치·사용 중·미지원을 구분한다', () => {
    expect(mapRecorderError(named('NotAllowedError'))).toBe('permission-denied')
    expect(mapRecorderError(named('NotFoundError'))).toBe('no-microphone')
    expect(mapRecorderError(named('NotReadableError'))).toBe('busy')
    expect(mapRecorderError(named('NotSupportedError'))).toBe('unsupported')
  })

  it('모르는 값은 unknown', () => {
    expect(mapRecorderError(named('WeirdError'))).toBe('unknown')
    expect(mapRecorderError('string')).toBe('unknown')
    expect(mapRecorderError(undefined)).toBe('unknown')
  })
})

describe('formatDuration', () => {
  it('m:ss 형식', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(7400)).toBe('0:07')
    expect(formatDuration(30000)).toBe('0:30')
    expect(formatDuration(61000)).toBe('1:01')
    expect(formatDuration(-5)).toBe('0:00')
  })
})

describe('levelFromSamples', () => {
  it('무음은 0, 큰 신호는 1로 포화한다', () => {
    expect(levelFromSamples(new Float32Array(0))).toBe(0)
    expect(levelFromSamples(new Float32Array(100))).toBe(0)
    expect(levelFromSamples(new Float32Array(100).fill(0.9))).toBe(1)
  })

  it('말소리 수준(RMS 0.1)은 중간 값', () => {
    const level = levelFromSamples(new Float32Array(100).fill(0.1))
    expect(level).toBeCloseTo(0.4, 5)
  })
})
