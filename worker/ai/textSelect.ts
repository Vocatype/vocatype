import type { TextProviderName } from '../../shared/api.ts'
import { createClaudeTextProvider, DEFAULT_TEXT_MODEL, isTextModel } from './claude.ts'
import { mockTextProvider } from './textMock.ts'
import type { TextProvider } from './types.ts'

export interface TextProviderEnv {
  TEXT_PROVIDER?: string
  /** 선택. 없으면 DEFAULT_TEXT_MODEL. */
  TEXT_MODEL?: string
  /** `wrangler secret put ANTHROPIC_API_KEY` 로만 넣는 비밀. 설정 파일에는 두지 않는다. */
  ANTHROPIC_API_KEY?: string
}

export function parseTextProviderName(value: string | undefined): TextProviderName {
  return value === 'claude' ? 'claude' : 'mock'
}

export function resolveTextModel(value: string | undefined): string {
  return isTextModel(value) ? value : DEFAULT_TEXT_MODEL
}

/**
 * 환경 설정으로 텍스트 제공자를 고른다.
 * TEXT_PROVIDER=claude 이면서 ANTHROPIC_API_KEY 가 있을 때만 Claude, 그 밖에는 모의 제공자.
 * 키가 없으면 켜지지 않으므로 설정 실수가 503 폭주로 이어지지 않는다.
 */
export function selectTextProvider(env: TextProviderEnv): TextProvider {
  const name = parseTextProviderName(env.TEXT_PROVIDER)
  const apiKey = env.ANTHROPIC_API_KEY?.trim()
  if (name === 'claude' && apiKey) return createClaudeTextProvider({ apiKey, model: resolveTextModel(env.TEXT_MODEL) })
  return mockTextProvider
}
