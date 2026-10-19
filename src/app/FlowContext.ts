import { createContext } from 'react'
import type { FlowState } from './flow'

export type FlowContextValue = Pick<FlowState, 'hasNavigated'>

export const FlowContext = createContext<FlowContextValue>({ hasNavigated: false })
