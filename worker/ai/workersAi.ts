import type { AiProvider, PortraitInput, PortraitOutput } from './types.ts'

export const PORTRAIT_MODEL = '@cf/black-forest-labs/flux-1-schnell'
const PORTRAIT_STEPS = 4

/**
 * 생성 타입의 입력에는 seed가 없다. Cloudflare 문서의 예제 코드는 seed를 넘기지만 파라미터 표에는 없어
 * 지원 여부가 확실하지 않다(README "배포 후 확인" 절차로 같은 씨앗이 같은 이미지를 주는지 확인한다).
 * 교차 타입으로 넘겨 타입 검사는 통과시키되, 모델이 무시하더라도 호출은 실패하지 않는다.
 */
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
      const result = await ai.run(PORTRAIT_MODEL, inputs)
      if (!result.image) return { image: null }
      return { image: `data:image/jpeg;base64,${result.image}` }
    },
  }
}
