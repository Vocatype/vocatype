export const FLOW_STEPS = ['landing', 'record', 'generating', 'result'] as const
export type FlowStep = (typeof FLOW_STEPS)[number]

/** 진행 표시에 쓰는 단계. 메인(landing)은 제외한다. */
export const PROGRESS_STEPS = ['record', 'generating', 'result'] as const satisfies readonly FlowStep[]
export type ProgressStep = (typeof PROGRESS_STEPS)[number]

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
