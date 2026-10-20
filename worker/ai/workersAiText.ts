import { normalizeReadingOutput, parseReadingJson } from './readingOutput.ts'
import { buildReadingUserMessage, READING_OUTPUT_SCHEMA, READING_SYSTEM_PROMPT } from './readingPrompt.ts'
import type { ReadingInput, ReadingOutput, TextProvider } from './types.ts'

/**
 * 무료 할당량으로 도는 Workers AI 텍스트 모델. JSON 모드(`response_format`)를 지원하고 한국어 품질이 8B 모델보다 낫다.
 * 리딩 1회 약 70뉴런(하루 무료 10,000뉴런을 초상과 함께 쓴다). 더 가벼운 모델로 바꾸려면 이 상수만 바꾼다(예: '@cf/meta/llama-3.1-8b-instruct-fp8').
 */
export const WORKERS_AI_TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
/** 리딩+캡션 JSON은 300토큰 안쪽이다. Llama 는 사고 토큰이 없다. */
const MAX_TOKENS = 600

type TextModelInput = AiModels[typeof WORKERS_AI_TEXT_MODEL]['inputs']

/** Claude 와 같은 프롬프트·같은 출력 스키마를 쓴다. */
export function buildWorkersAiTextInput(input: ReadingInput): TextModelInput {
  return {
    messages: [
      { role: 'system', content: READING_SYSTEM_PROMPT },
      { role: 'user', content: buildReadingUserMessage(input) },
    ],
    max_tokens: MAX_TOKENS,
    response_format: { type: 'json_schema', json_schema: READING_OUTPUT_SCHEMA },
  }
}

/** JSON 모드 응답은 문자열로도, 이미 파싱된 객체로도 올 수 있다. 둘 다 공용 검증을 거친다. */
export function parseWorkersAiTextResult(result: unknown): ReadingOutput {
  const response = (result as { response?: unknown } | null | undefined)?.response
  if (typeof response === 'string') return parseReadingJson(response)
  if (typeof response === 'object' && response !== null) return normalizeReadingOutput(response)
  throw new Error('empty response')
}

/** Workers AI 텍스트 제공자. 실패(할당량 소진 4006, 429, 형식 불일치)는 예외로 던져 체인이 다음 제공자로 넘어가게 한다. */
export function createWorkersAiTextProvider(ai: Ai): TextProvider {
  return {
    name: 'workers-ai',
    supportsReading: true,
    async generateReading(input: ReadingInput): Promise<ReadingOutput> {
      const result = await ai.run(WORKERS_AI_TEXT_MODEL, buildWorkersAiTextInput(input))
      const usage = (result as { usage?: { prompt_tokens?: number; completion_tokens?: number } } | null)?.usage
      // 비용 추적용 토큰 수만 남긴다(사용자 데이터 없음).
      console.info(`[reading] workers-ai ${WORKERS_AI_TEXT_MODEL} in=${usage?.prompt_tokens ?? '?'} out=${usage?.completion_tokens ?? '?'}`)
      return parseWorkersAiTextResult(result)
    },
  }
}
