import Anthropic from '@anthropic-ai/sdk'
import { CAPTION_MAX_CHARS, CAPTION_MIN_CHARS, READING_MAX_CHARS, READING_MIN_CHARS } from '../../shared/api.ts'
import { buildReadingUserMessage, READING_OUTPUT_SCHEMA, READING_SYSTEM_PROMPT } from './readingPrompt.ts'
import type { ReadingInput, ReadingOutput, TextProvider } from './types.ts'

/** 기본 모델. 3~4문장 생성은 Haiku로 충분하고 가장 싸다. `TEXT_MODEL` 변수로 바꿀 수 있다. */
export const DEFAULT_TEXT_MODEL = 'claude-haiku-5-5'

/** 모델 이름은 `claude-`로 시작하는 식별자만 받는다. 설정 오타나 이상한 값이 요청에 실리지 않게 한다. */
export function isTextModel(value: unknown): value is string {
  return typeof value === 'string' && /^claude-[a-z0-9][a-z0-9.-]{0,63}$/.test(value)
}

/** SDK 타임아웃은 밀리초. 재시도 1회를 더해도 클라이언트 타임아웃(30초) 안에 끝난다. */
const REQUEST_TIMEOUT_MS = 12_000
const MAX_RETRIES = 1
/** 적응형 사고가 켜져 있어 사고 토큰까지 포함한 여유. 실제 출력은 200토큰 안팎이다. */
const MAX_TOKENS = 1024

export type CreateMessage = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>

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
export function parseReadingMessage(message: Anthropic.Message): ReadingOutput {
  if (message.stop_reason === 'refusal') throw new Error(`refusal: ${String(message.stop_details?.category ?? 'unknown')}`)
  if (message.stop_reason === 'max_tokens') throw new Error('response truncated (max_tokens)')
  // 응답은 thinking 블록으로 시작할 수 있으므로 위치가 아니라 type 으로 텍스트를 고른다.
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('response is not JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('response is not an object')
  const { reading, caption } = parsed as { reading?: unknown; caption?: unknown }
  const cleanReading = typeof reading === 'string' ? reading.replace(/\s+/g, ' ').trim() : ''
  const cleanCaption = typeof caption === 'string' ? caption.replace(/\s+/g, ' ').trim() : ''
  if (cleanReading.length < READING_MIN_CHARS || cleanReading.length > READING_MAX_CHARS) throw new Error(`reading length ${cleanReading.length}`)
  if (cleanCaption.length < CAPTION_MIN_CHARS || cleanCaption.length > CAPTION_MAX_CHARS) throw new Error(`caption length ${cleanCaption.length}`)
  return { reading: cleanReading, caption: cleanCaption }
}

/**
 * Claude 텍스트 제공자. 요청마다 클라이언트를 만든다(Workers는 전역에서 I/O 객체를 만들지 않는다).
 * 생성된 글은 응답으로만 돌아가고 어디에도 저장하지 않는다.
 */
export function createClaudeTextProvider(options: ClaudeTextProviderOptions): TextProvider {
  const model = options.model ?? DEFAULT_TEXT_MODEL
  const createMessage: CreateMessage =
    options.createMessage ??
    ((params) => new Anthropic({ apiKey: options.apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES }).messages.create(params))
  return {
    name: 'claude',
    supportsReading: true,
    async generateReading(input: ReadingInput): Promise<ReadingOutput> {
      const message = await createMessage(buildReadingParams(input, model))
      return parseReadingMessage(message)
    },
  }
}
