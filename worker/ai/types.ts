import type { AiProviderName, ReadingRequest, TextProviderName } from '../../shared/api.ts'

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

/* ---------- 텍스트(목소리 리딩) 제공자 ---------- */

/** 리딩 입력. 타입 코드, 0..1 여섯 축(소수 둘째 자리), 출력 언어뿐이다. 음성은 없다. */
export type ReadingInput = ReadingRequest

export interface ReadingOutput {
  /** 3~4문장 한 문단. */
  reading: string
  /** 공유용 한 줄. */
  caption: string
}

/** 텍스트 제공자 어댑터. 이미지 제공자와 별도로 켜진다. */
export interface TextProvider {
  readonly name: TextProviderName
  /** 이 제공자가 리딩을 실제로 만드는지. 클라이언트는 false면 호출하지 않는다. */
  readonly supportsReading: boolean
  generateReading(input: ReadingInput): Promise<ReadingOutput>
}
