import { createContext } from 'react'

export interface FlowContextValue {
  /** 사용자가 한 번이라도 화면을 옮긴 뒤인지. 첫 로드에서는 제목에 초점을 주지 않는다. */
  hasNavigated: boolean
}

export const FlowContext = createContext<FlowContextValue>({ hasNavigated: false })
