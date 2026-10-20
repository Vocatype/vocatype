import type { ReadingInput, ReadingOutput, TextProvider } from './types.ts'

/**
 * 모의 제공자의 고정 문구. 체인의 마지막 안전망이며 실패하지 않는다.
 * 클라이언트는 provider 가 'mock' 이면 리딩이 없는 것으로 보고 카탈로그 설명을 쓰므로 사용자에게는 보이지 않는다.
 */
const FIXED_READINGS: Record<ReadingInput['locale'], ReadingOutput> = {
  ko: {
    reading:
      '설정된 텍스트 제공자가 없거나 모두 실패해 모의 고정 문구가 왔어요. 결과 화면은 이 문장 대신 카탈로그의 타입 설명을 보여 줘요. 이 문장은 로컬 확인과 테스트에만 쓰여요. 목소리는 어디에도 보내지지 않았어요.',
    caption: '모의 리딩 · 화면에는 보이지 않아요',
  },
  en: {
    reading:
      'No text provider is configured or every provider failed, so this is the fixed mock text. The result screen shows the catalog description instead of these sentences. They only appear in local checks and tests. Your voice was never sent anywhere.',
    caption: 'Mock reading · never shown on screen',
  },
}

export const mockTextProvider: TextProvider = {
  name: 'mock',
  supportsReading: false,
  async generateReading(input: ReadingInput): Promise<ReadingOutput> {
    return FIXED_READINGS[input.locale]
  },
}
