import { describe, expect, it } from 'vitest'
import { formatMessage } from './format'

describe('formatMessage', () => {
  it('자리표시자를 값으로 치환한다', () => {
    expect(formatMessage('{count}초 남음', { count: 12 })).toBe('12초 남음')
  })

  it('값이 없는 자리표시자는 그대로 둔다', () => {
    expect(formatMessage('{a} / {b}', { a: 'x' })).toBe('x / {b}')
  })

  it('params가 없으면 원문을 돌려준다', () => {
    expect(formatMessage('hello')).toBe('hello')
  })
})
