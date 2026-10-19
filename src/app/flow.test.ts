import { describe, expect, it } from 'vitest'
import { canTransition, FLOW_STEPS, flowReducer, INITIAL_FLOW_STATE, PROGRESS_STEPS } from './flow'

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

describe('flowReducer', () => {
  it('허용된 전이는 단계를 바꾸고 hasNavigated를 켠다', () => {
    const next = flowReducer(INITIAL_FLOW_STATE, 'record')
    expect(next).toEqual({ step: 'record', hasNavigated: true })
  })

  it('막힌 전이는 같은 상태 객체를 돌려준다', () => {
    expect(flowReducer(INITIAL_FLOW_STATE, 'result')).toBe(INITIAL_FLOW_STATE)
    const recording = flowReducer(INITIAL_FLOW_STATE, 'record')
    expect(flowReducer(recording, 'result')).toBe(recording)
  })

  it('뒤늦게 도착한 전이는 현재 단계 기준으로 판단한다', () => {
    // 생성 중 취소로 record에 돌아간 뒤, 생성 화면이 쥐고 있던 콜백이 result로 가자고 해도 막힌다.
    const generating = flowReducer(flowReducer(INITIAL_FLOW_STATE, 'record'), 'generating')
    const backToRecord = flowReducer(generating, 'record')
    expect(flowReducer(backToRecord, 'result')).toBe(backToRecord)
  })
})
