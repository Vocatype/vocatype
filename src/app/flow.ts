export const FLOW_STEPS = ['landing', 'record', 'generating', 'result'] as const
export type FlowStep = (typeof FLOW_STEPS)[number]

/** 진행 표시에 쓰는 단계. 메인(landing)은 제외한다. */
export const PROGRESS_STEPS = ['record', 'generating', 'result'] as const satisfies readonly FlowStep[]

/** 각 단계에서 이동할 수 있는 단계. 화면 버튼은 이 표 안의 전이만 일으킨다. */
const TRANSITIONS: Record<FlowStep, readonly FlowStep[]> = {
  landing: ['record'],
  record: ['landing', 'generating'],
  generating: ['record', 'result'],
  result: ['landing', 'record'],
}

export function canTransition(from: FlowStep, to: FlowStep): boolean {
  return TRANSITIONS[from].includes(to)
}

export interface FlowState {
  step: FlowStep
  /** 사용자가 한 번이라도 화면을 옮긴 뒤인지. 첫 로드에서는 제목에 초점을 주지 않는다. */
  hasNavigated: boolean
}

export const INITIAL_FLOW_STATE: FlowState = { step: 'landing', hasNavigated: false }

/**
 * 흐름 리듀서. 허용된 전이만 적용하고 나머지는 상태를 그대로 둔다.
 * 비동기 콜백이 뒤늦게 호출돼도 항상 현재 단계를 기준으로 판단하므로 건너뛰기가 생기지 않는다.
 * hasNavigated가 바뀌는 순간은 항상 step이 바뀌는 순간과 같다(= 화면 재마운트).
 */
export function flowReducer(state: FlowState, to: FlowStep): FlowState {
  return canTransition(state.step, to) ? { step: to, hasNavigated: true } : state
}
