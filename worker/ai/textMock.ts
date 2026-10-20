import type { ReadingInput, ReadingOutput, TextProvider } from './types.ts'

/** 모의 제공자가 돌려주는 고정 문구. 로컬 확인·테스트용이며 운영에서는 클라이언트가 이 제공자를 호출하지 않는다. */
const FIXED_READINGS: Record<ReadingInput['locale'], ReadingOutput> = {
  ko: {
    reading:
      '모의 텍스트 제공자의 고정 문구예요. 실제 리딩은 TEXT_PROVIDER=claude 와 ANTHROPIC_API_KEY 를 설정하면 생성돼요. 이 문장은 로컬 확인과 테스트에만 쓰여요. 목소리는 어디에도 보내지지 않았어요.',
    caption: '모의 리딩 · 설정을 켜면 진짜 문장이 와요',
  },
  en: {
    reading:
      'This is the fixed text from the mock text provider. Real readings are generated once TEXT_PROVIDER=claude and ANTHROPIC_API_KEY are set. These sentences only appear in local checks and tests. Your voice was never sent anywhere.',
    caption: 'Mock reading · turn the provider on for real words',
  },
}

/** 모의 텍스트 제공자. 고정 문구를 돌려주고, 클라이언트가 호출하지 않도록 supportsReading 은 false 다. */
export const mockTextProvider: TextProvider = {
  name: 'mock',
  supportsReading: false,
  async generateReading(input: ReadingInput): Promise<ReadingOutput> {
    return FIXED_READINGS[input.locale]
  },
}
