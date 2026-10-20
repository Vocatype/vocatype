import { PORTRAIT_SERVER_TIMEOUT_MS } from '../../shared/api.ts'
import type { AiProvider, PortraitInput, PortraitOutput } from './types.ts'

/**
 * 초상 생성 모델. Leonardo Lucid Origin은 실사 지향이고 `seed`를 받아 같은 씨앗이면 같은 얼굴·구도가 나온다.
 * 응답 바이트는 매번 조금 달라(GPU 비결정성) 해시로는 비교할 수 없다 — 015 실측.
 * (Flux 1 schnell은 `seed` 입력을 거부한다: "Additional properties '/seed' not allowed" — 007에서 확인.)
 */
export const PORTRAIT_MODEL = '@cf/leonardo/lucid-origin'
/** 정사각 초상. 결과 카드가 1:1로 쓴다. 크기를 줄이면 비용과 시간이 준다. */
export const PORTRAIT_SIZE = 768

/** base64 앞부분으로 이미지 형식을 알아낸다. 모델이 어떤 형식을 주든 올바른 data URL을 만들기 위해. */
export function detectImageMime(base64: string): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('iVBOR')) return 'image/png'
  if (base64.startsWith('UklGR')) return 'image/webp'
  return null
}

/**
 * Cloudflare Workers AI 제공자.
 * 결과는 base64 이미지이며 저장하지 않고 응답으로만 돌려준다.
 * 호출은 `timeoutMs`(기본 PORTRAIT_SERVER_TIMEOUT_MS, shared/api.ts 의 초상 시간 규칙)에서 바인딩 옵션 신호로 끊는다.
 * 바인딩은 이 신호를 추론 요청 fetch 에 그대로 건다(020 확인, workersAiText.ts 주석). 끊으면 TimeoutError 로 실패하고 라우트는 503 으로 답한다.
 * 끊은 뒤 Cloudflare 쪽 추론이 멈추는지는 바인딩 밖의 일이다.
 */
export function createWorkersAiProvider(ai: Ai, timeoutMs: number = PORTRAIT_SERVER_TIMEOUT_MS): AiProvider {
  return {
    name: 'workers-ai',
    supportsPortrait: true,
    async generatePortrait(input: PortraitInput): Promise<PortraitOutput> {
      const result = await ai.run(
        PORTRAIT_MODEL,
        {
          prompt: input.prompt,
          seed: input.seed,
          width: PORTRAIT_SIZE,
          height: PORTRAIT_SIZE,
        },
        { signal: AbortSignal.timeout(timeoutMs) },
      )
      if (!result.image) return { image: null }
      const mime = detectImageMime(result.image)
      if (!mime) return { image: null }
      return { image: `data:${mime};base64,${result.image}` }
    },
  }
}
