import { describe, expect, it } from 'vitest'
import { en } from './en'
import { ko } from './ko'

describe('messages', () => {
  it('영어 사전은 한국어 사전과 같은 키 집합을 가진다', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ko).sort())
  })

  it('빈 메시지가 없다', () => {
    for (const dictionary of [ko, en]) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value.trim().length, `${key} is empty`).toBeGreaterThan(0)
      }
    }
  })
})
