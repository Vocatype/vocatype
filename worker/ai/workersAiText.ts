import { normalizeReadingOutput, parseReadingJson } from './readingOutput.ts'
import { buildReadingUserMessage, READING_OUTPUT_SCHEMA, READING_SYSTEM_PROMPT } from './readingPrompt.ts'
import type { ReadingInput, ReadingOutput, TextProvider } from './types.ts'

/**
 * 무료 할당량으로 도는 Workers AI 텍스트 모델. JSON 모드(`response_format`)를 지원해야 한다.
 * 011 실측(같은 프롬프트·같은 파서): Llama 3.3 70B(fp8 fast)는 영어에서 2/2회 문장을 끝내지 못하고 max_tokens 까지 달려(27~30초, 약 227뉴런)
 * JSON 이 깨졌고 체인 시간 예산(25초)까지 써 버려 Claude 로도 못 넘어갔다. Llama 4 Scout 는 ko/en 6/6회 3~4문장·캡션 길이·금지어 규칙을 지켰고
 * 2~9초, 1회 약 22~25뉴런(하루 무료 10,000뉴런을 초상과 함께 쓴다)이라 이쪽으로 정했다. 다른 모델로 바꾸려면 이 상수만 바꾼다.
 */
export const WORKERS_AI_TEXT_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'
/**
 * 실측 출력은 리딩+캡션 JSON 이 ko 80~100, en 87~112토큰(Llama 토크나이저). 잘리면 JSON 불일치로 다음 제공자로 넘어가지만,
 * 상한이 크면 문장이 끝나지 않는 폭주가 체인 시간 예산을 먹으므로 약 5배 여유만 둔다. 실제 출력 토큰만 과금된다.
 */
const MAX_TOKENS = 512

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

/**
 * Workers AI 텍스트 제공자. 실패(할당량 소진 4006, 429, 형식 불일치)는 예외로 던져 체인이 다음 제공자로 넘어가게 한다.
 * 바인딩 호출 옵션에는 중단 신호가 없어 체인의 시간 예산 신호는 받지 못한다(체인은 이 호출이 오래 걸리면 다음 제공자를 건너뛴다).
 */
export function createWorkersAiTextProvider(ai: Ai): TextProvider {
  return {
    name: 'workers-ai',
    async generateReading(input: ReadingInput): Promise<ReadingOutput> {
      const result = await ai.run(WORKERS_AI_TEXT_MODEL, buildWorkersAiTextInput(input))
      const usage = (result as { usage?: { prompt_tokens?: number; completion_tokens?: number } } | null)?.usage
      // 비용 추적용 토큰 수만 남긴다(사용자 데이터 없음).
      console.info(`[reading] workers-ai ${WORKERS_AI_TEXT_MODEL} in=${usage?.prompt_tokens ?? '?'} out=${usage?.completion_tokens ?? '?'}`)
      return parseWorkersAiTextResult(result)
    },
  }
}
