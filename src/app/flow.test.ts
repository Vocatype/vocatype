import { describe, expect, it } from 'vitest'
import { canTransition, FLOW_STEPS, PROGRESS_STEPS } from './flow'

describe('canTransition', () => {
  it('정상 흐름을 허용한다', () => {
    expect(canTransition('landing', 'record')).toBe(true)
    expect(canTransition('record', 'generating')).toBe(true)
    expect(canTransition('generating', 'result')).toBe(true)
  })

  it('되돌아가기와 다시 하기를 허용한다', () => {
    expect(canTransition('record', 'landing')).toBe(true)
    expect(canTransition('generating', 'record')).toBe(true)
    expect(canTransition('result', 'landing')).toBe(true)
    expect(canTransition('result', 'record')).toBe(true)
  })

  it('건너뛰기와 제자리 이동을 막는다', () => {
    expect(canTransition('landing', 'result')).toBe(false)
    expect(canTransition('landing', 'generating')).toBe(false)
    expect(canTransition('record', 'result')).toBe(false)
    for (const step of FLOW_STEPS) expect(canTransition(step, step)).toBe(false)
  })

  it('진행 단계는 흐름 순서를 따른다', () => {
    expect(PROGRESS_STEPS).toEqual(['record', 'generating', 'result'])
  })
})
