import type { AiProvider, PortraitInput, PortraitOutput } from './types.ts'

export const PORTRAIT_MODEL = '@cf/black-forest-labs/flux-1-schnell'
const PORTRAIT_STEPS = 4

interface FluxResult {
  image?: string
}

/** 생성 타입에는 seed가 빠져 있지만 모델은 받는다(문서 참고). 교차 타입으로 넘긴다. */
type FluxInput = AiModels[typeof PORTRAIT_MODEL]['inputs'] & { seed?: number }

/**
 * Cloudflare Workers AI 제공자.
 * Flux 1 schnell로 실사 초상을 생성한다. 결과는 base64 JPEG이며 저장하지 않고 응답으로만 돌려준다.
 */
export function createWorkersAiProvider(ai: Ai): AiProvider {
  return {
    name: 'workers-ai',
    supportsPortrait: true,
    async generatePortrait(input: PortraitInput): Promise<PortraitOutput> {
      const inputs: FluxInput = { prompt: input.prompt, steps: PORTRAIT_STEPS, seed: input.seed }
      const result = (await ai.run(PORTRAIT_MODEL, inputs)) as FluxResult
      if (!result.image) return { image: null }
      return { image: `data:image/jpeg;base64,${result.image}` }
    },
  }
}
