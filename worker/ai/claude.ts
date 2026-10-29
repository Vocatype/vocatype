import Anthropic from '@anthropic-ai/sdk'
import { READING_CHAIN_BUDGET_MS } from '../../shared/api.ts'
import { parseReadingJson } from './readingOutput.ts'
import { buildReadingUserMessage, READING_OUTPUT_SCHEMA, READING_SYSTEM_PROMPT } from './readingPrompt.ts'
import type { GenerateOptions, ReadingInput, ReadingOutput, TextProvider } from './types.ts'

/** 기본 모델. 3~4문장 생성은 Haiku로 충분하고 가장 싸다. `TEXT_MODEL` 변수로 바꿀 수 있다. */
export const DEFAULT_TEXT_MODEL = 'claude-haiku-5-5'

/** 모델 이름은 `claude-`로 시작하는 식별자만 받는다. 설정 오타나 이상한 값이 요청에 실리지 않게 한다. */
export function isTextModel(value: unknown): value is string {
  return typeof value === 'string' && /^claude-[a-z0-9][a-z0-9.-]{0,63}$/.test(value)
}

/**
 * SDK 타임아웃은 밀리초(요청 1회 기준).
 * 재시도·대기(retry-after)까지 합친 실제 상한은 SDK 설정이 아니라 중단 신호가 건다: 체인 안에서는 체인이 배분한 시간, 체인 밖에서는 체인 예산 전체.
 * 그 상한과의 관계 두 가지를 claude.test.ts 가 검사한다:
 * - 예산 전부를 받을 때(체인 밖이거나 체인의 유일한 제공자. 마지막 제공자는 남은 예산, 최대 40초): 요청 12초 × 시도 3번 + 재시도 대기(최대 0.5 + 1초) = 37.5초 ≤ 40초
 * - 뒤 제공자가 있을 때(운영 순서 claude,workers-ai): 받은 28초(40 − 12) 안에 요청 12초 두 번과 첫 재시도 대기가 다 들어간다(24.5초). 세 번째 시도와 계약 위반 재호출은 남은 시간 안에서만 된다
 */
export const REQUEST_TIMEOUT_MS = 12_000
/** SDK 자동 재시도 횟수. 시도는 1 + 이 값이다. 529 과부하·429 같은 빠른 일시 오류에서 Claude 가 답할 기회를 늘린다(031). */
export const MAX_RETRIES = 2
/**
 * 출력이 계약(JSON·길이)에 맞지 않거나 max_tokens 로 잘렸을 때 Claude 를 다시 부르는 횟수(031). 체인이 준 신호 안에서만 부른다.
 * 거부(refusal)는 같은 프롬프트로 다시 불러도 거부되므로 다시 부르지 않는다.
 */
export const CONTRACT_RETRIES = 1
/**
 * 적응형 사고가 켜져 있어 사고 토큰이 max_tokens 에 포함된다. 실제 출력은 200토큰 안팎이지만
 * 사고가 길어져 잘리면(503 → 폴백) 사용자에게 리딩이 조용히 사라지므로 넉넉히 둔다. 쓴 토큰만 과금된다.
 */
const MAX_TOKENS = 4096

export interface CreateMessageOptions {
  signal?: AbortSignal
}

export type CreateMessage = (params: Anthropic.MessageCreateParamsNonStreaming, options?: CreateMessageOptions) => Promise<Anthropic.Message>

export interface ClaudeTextProviderOptions {
  apiKey: string
  model?: string
  /** 테스트용. 기본은 SDK 클라이언트의 `messages.create`. */
  createMessage?: CreateMessage
}

/** 요청 본문. 프롬프트는 서버가 만들고, 구조화 출력으로 JSON 형식을 강제한다. */
export function buildReadingParams(input: ReadingInput, model: string): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: MAX_TOKENS,
    system: READING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildReadingUserMessage(input) }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: READING_OUTPUT_SCHEMA } },
  }
}

/** 응답에서 리딩과 캡션을 꺼내 정리·검증한다. 거부·잘림·형식 불일치·길이 초과면 예외를 던진다. */
export function parseReadingMessage(message: Anthropic.Message, locale: ReadingInput['locale']): ReadingOutput {
  if (message.stop_reason === 'refusal') throw new Error(`refusal: ${String(message.stop_details?.category ?? 'unknown')}`)
  if (message.stop_reason === 'max_tokens') throw new Error('response truncated (max_tokens)')
  // 응답은 thinking 블록으로 시작할 수 있으므로 위치가 아니라 type 으로 텍스트를 고른다.
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
  return parseReadingJson(text, locale)
}

/**
 * Claude 텍스트 제공자. 요청마다 클라이언트를 만든다(Workers는 전역에서 I/O 객체를 만들지 않는다).
 * 생성된 글은 응답으로만 돌아가고 어디에도 저장하지 않는다.
 */
export function createClaudeTextProvider(options: ClaudeTextProviderOptions): TextProvider {
  const model = options.model ?? DEFAULT_TEXT_MODEL
  const createMessage: CreateMessage =
    options.createMessage ??
    ((params, requestOptions) =>
      new Anthropic({ apiKey: options.apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES }).messages.create(params, requestOptions))
  return {
    name: 'claude',
    async generateReading(input: ReadingInput, options?: GenerateOptions): Promise<ReadingOutput> {
      // 체인이 배분한 시간을 신호로 주면 그걸 쓰고, 없으면 체인 예산 전체를 자체 상한으로 건다.
      // SDK 는 서버가 준 retry-after 를 그대로 기다리므로, 신호가 없으면 클라이언트가 포기한 뒤에도 두 번째 호출이 나가 비용을 쓸 수 있다.
      const signal = options?.signal ?? AbortSignal.timeout(READING_CHAIN_BUDGET_MS)
      const params = buildReadingParams(input, model)
      for (let attempt = 0; ; attempt += 1) {
        let message: Anthropic.Message
        try {
          message = await createMessage(params, { signal })
        } catch (cause) {
          // SDK 는 중단을 APIUserAbortError 로만 알리므로, 시간 예산에 걸린 경우임을 로그에서 알 수 있게 바꿔 던진다.
          if (signal.aborted) throw new Error('time budget exceeded (retries included)', { cause })
          throw cause
        }
        // 비용 추적용 토큰 수만 남긴다(사용자 데이터 없음). 운영에서는 observability 가 꺼져 있어 어디에도 저장되지 않는다.
        console.info(`[reading] claude ${message.model} in=${message.usage.input_tokens} out=${message.usage.output_tokens} stop=${message.stop_reason ?? 'none'}`)
        try {
          return parseReadingMessage(message, input.locale)
        } catch (cause) {
          if (attempt >= CONTRACT_RETRIES || message.stop_reason === 'refusal' || signal.aborted) throw cause
          // 체인으로 넘기기 전에 남은 시간 안에서 한 번 더 부른다. 오류 메시지만 남긴다(응답 본문 없음).
          console.warn(`[reading] claude output rejected, retrying: ${cause instanceof Error ? cause.message : String(cause)}`)
        }
      }
    },
  }
}
