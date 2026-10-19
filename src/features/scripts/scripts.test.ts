import { describe, expect, it } from 'vitest'
import { estimateReadingSeconds, pickScript, SCRIPTS, scriptsFor } from './scripts'

describe('scripts', () => {
  it('id가 겹치지 않는다', () => {
    const ids = SCRIPTS.map((script) => script.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('로케일마다 최소 다섯 편이 있다', () => {
    expect(scriptsFor('ko').length).toBeGreaterThanOrEqual(5)
    expect(scriptsFor('en').length).toBeGreaterThanOrEqual(5)
  })

  it('빈 스크립트가 없고 내용 줄이 하나 이상 있다', () => {
    for (const script of SCRIPTS) {
      expect(script.lines.some((line) => line.trim().length > 0), script.id).toBe(true)
      expect(script.title.length, script.id).toBeGreaterThan(0)
      expect(script.author.length, script.id).toBeGreaterThan(0)
    }
  })

  it('낭독 예상 시간이 10~40초 안에 든다', () => {
    for (const script of SCRIPTS) {
      const seconds = estimateReadingSeconds(script)
      expect(seconds, `${script.id}: ${seconds}s`).toBeGreaterThanOrEqual(10)
      expect(seconds, `${script.id}: ${seconds}s`).toBeLessThanOrEqual(40)
    }
  })
})

describe('pickScript', () => {
  it('로케일에 맞는 글을 고른다', () => {
    expect(pickScript('ko').locale).toBe('ko')
    expect(pickScript('en').locale).toBe('en')
  })

  it('excludeId로 지정한 글은 피한다', () => {
    const first = pickScript('ko', undefined, () => 0)
    for (let i = 0; i < 20; i += 1) {
      expect(pickScript('ko', first.id).id).not.toBe(first.id)
    }
  })

  it('random이 1에 가까워도 범위를 벗어나지 않는다', () => {
    expect(() => pickScript('en', undefined, () => 0.999999)).not.toThrow()
  })
})
