import type { AiProviderName } from '../../shared/api.ts'

export interface PortraitInput {
  prompt: string
  seed: number
}

export interface PortraitOutput {
  /** data URL. 만들지 못하면 null. */
  image: string | null
}

/** AI 제공자 어댑터. 새 제공자는 이 인터페이스만 구현하면 된다. */
export interface AiProvider {
  readonly name: AiProviderName
  /** 이 제공자가 초상을 실제로 만들 수 있는지. 클라이언트는 false면 호출하지 않는다. */
  readonly supportsPortrait: boolean
  generatePortrait(input: PortraitInput): Promise<PortraitOutput>
}
