import type { AiProviderName } from '../../shared/api.ts'
import { mockProvider } from './mock.ts'
import { createOpenAiImageProvider, resolveImageModel } from './openaiImage.ts'
import type { AiProvider } from './types.ts'
import { createWorkersAiProvider } from './workersAi.ts'

export interface ProviderEnv {
  AI_PROVIDER?: string
  AI?: Ai
  /** `wrangler secret put OPENAI_API_KEY` 로만 넣는 비밀. 설정 파일에는 두지 않는다. */
  OPENAI_API_KEY?: string
  /** 선택. OpenAI 이미지 모델. 없으면 DEFAULT_IMAGE_MODEL. */
  IMAGE_MODEL?: string
}

export function parseProviderName(value: string | undefined): AiProviderName {
  if (value === 'workers-ai' || value === 'openai') return value
  return 'mock'
}

/**
 * 환경 설정으로 제공자를 고른다.
 * AI_PROVIDER=workers-ai 이면서 AI 바인딩이 있을 때 Workers AI, AI_PROVIDER=openai 이면서 OPENAI_API_KEY 가 있을 때 OpenAI, 그 밖에는 모의 제공자.
 */
export function selectProvider(env: ProviderEnv): AiProvider {
  const name = parseProviderName(env.AI_PROVIDER)
  if (name === 'workers-ai' && env.AI) return createWorkersAiProvider(env.AI)
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (name === 'openai' && apiKey) return createOpenAiImageProvider({ apiKey, model: resolveImageModel(env.IMAGE_MODEL) })
  return mockProvider
}
