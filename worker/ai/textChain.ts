import type { TextProviderName } from '../../shared/api.ts'
import { createClaudeTextProvider, DEFAULT_TEXT_MODEL, isTextModel } from './claude.ts'
import { mockTextProvider } from './textMock.ts'
import type { ReadingInput, ReadingOutput, TextProvider } from './types.ts'
import { createWorkersAiTextProvider } from './workersAiText.ts'

export interface TextProviderEnv {
  /** 콤마 목록. 예: "workers-ai,claude". 순서대로 시도한다. */
  TEXT_PROVIDER?: string
  /** 선택. Claude 모델. 없으면 DEFAULT_TEXT_MODEL. */
  TEXT_MODEL?: string
  /** `wrangler secret put ANTHROPIC_API_KEY` 로만 넣는 비밀. 설정 파일에는 두지 않는다. */
  ANTHROPIC_API_KEY?: string
  /** Workers AI 바인딩. 없으면 workers-ai 는 체인에서 빠진다. */
  AI?: Ai
}

/** 체인에 들어갈 수 있는 이름. mock 은 명시해도 넣지 않는다(항상 마지막 안전망). */
export type ChainProviderName = Exclude<TextProviderName, 'mock'>
const CHAIN_NAMES: readonly ChainProviderName[] = ['workers-ai', 'claude']

function isChainProviderName(value: string): value is ChainProviderName {
  return (CHAIN_NAMES as readonly string[]).includes(value)
}

/** 콤마로 나누고 공백을 지운 뒤 아는 이름만 순서대로, 중복은 처음 것만 남긴다. */
export function parseTextProviderChain(value: string | undefined): ChainProviderName[] {
  const names: ChainProviderName[] = []
  for (const raw of (value ?? '').split(',')) {
    const name = raw.trim()
    if (isChainProviderName(name) && !names.includes(name)) names.push(name)
  }
  return names
}

export function resolveTextModel(value: string | undefined): string {
  return isTextModel(value) ? value : DEFAULT_TEXT_MODEL
}

/**
 * 설정 순서대로 실제로 쓸 수 있는 제공자만 조립한다.
 * workers-ai 는 AI 바인딩이, claude 는 ANTHROPIC_API_KEY 가 있을 때만 들어간다(없으면 조용히 제외).
 */
export function buildTextChain(env: TextProviderEnv): TextProvider[] {
  const apiKey = env.ANTHROPIC_API_KEY?.trim()
  const providers: TextProvider[] = []
  for (const name of parseTextProviderChain(env.TEXT_PROVIDER)) {
    if (name === 'workers-ai' && env.AI) providers.push(createWorkersAiTextProvider(env.AI))
    if (name === 'claude' && apiKey) providers.push(createClaudeTextProvider({ apiKey, model: resolveTextModel(env.TEXT_MODEL) }))
  }
  return providers
}

export interface ReadingResult extends ReadingOutput {
  /** 실제로 답한 제공자. 모두 실패했으면 'mock'. */
  provider: TextProviderName
}

export interface TextChain {
  /** 체인에 든 제공자 이름(순서대로). /api/config 에 그대로 나간다. */
  readonly names: TextProviderName[]
  /** 하나라도 있으면 true. 클라이언트는 false 면 호출하지 않는다. */
  readonly supportsReading: boolean
  /** 던지지 않는다. 모두 실패하면 mock 고정 문구를 돌려준다. */
  generateReading(input: ReadingInput): Promise<ReadingResult>
}

export interface ChainLogger {
  warn(message: string): void
  error(message: string): void
}

function describe(cause: unknown): string {
  return cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)
}

/**
 * 폴백 체인. 앞에서부터 시도하고, 예외(할당량 소진·429·타임아웃·거부·형식 불일치)가 나면 이유를 로그에 남기고 다음으로 넘어간다.
 * 로그에는 오류 이름·메시지만 들어간다(요청 본문·축 값 없음).
 */
export function createTextChain(providers: readonly TextProvider[], options: { fallback?: TextProvider; logger?: ChainLogger } = {}): TextChain {
  const fallback = options.fallback ?? mockTextProvider
  const logger = options.logger ?? console
  return {
    names: providers.map((provider) => provider.name),
    supportsReading: providers.length > 0,
    async generateReading(input: ReadingInput): Promise<ReadingResult> {
      const failures: string[] = []
      for (const provider of providers) {
        try {
          const output = await provider.generateReading(input)
          return { ...output, provider: provider.name }
        } catch (cause) {
          const reason = describe(cause)
          failures.push(`${provider.name}: ${reason}`)
          logger.warn(`[reading] ${provider.name} failed, falling back: ${reason}`)
        }
      }
      if (providers.length > 0) logger.error(`[reading] all providers failed (${failures.join(' | ')}), using ${fallback.name}`)
      const output = await fallback.generateReading(input)
      return { ...output, provider: fallback.name }
    },
  }
}

/** 환경 설정으로 체인을 만든다. 라우트는 이것만 쓴다. */
export function selectTextChain(env: TextProviderEnv): TextChain {
  return createTextChain(buildTextChain(env))
}
