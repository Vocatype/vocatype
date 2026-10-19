import type { AiProviderName } from '../../shared/api.ts'
import { mockProvider } from './mock.ts'
import type { AiProvider } from './types.ts'
import { createWorkersAiProvider } from './workersAi.ts'

export interface ProviderEnv {
  AI_PROVIDER?: string
  AI?: Ai
}

export function parseProviderName(value: string | undefined): AiProviderName {
  return value === 'workers-ai' ? 'workers-ai' : 'mock'
}

/**
 * 환경 설정으로 제공자를 고른다.
 * AI_PROVIDER=workers-ai 이면서 AI 바인딩이 있을 때만 Workers AI, 그 밖에는 모의 제공자.
 */
export function selectProvider(env: ProviderEnv): AiProvider {
  const name = parseProviderName(env.AI_PROVIDER)
  if (name === 'workers-ai' && env.AI) return createWorkersAiProvider(env.AI)
  return mockProvider
}
