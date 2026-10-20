/**
 * 지원 언어의 단일 출처. 화면 사전·감지(src/i18n), 카탈로그 문구(catalog.ts의 Localized),
 * 리딩 요청 계약(api.ts의 ReadingRequest.locale), Worker 검증(worker/reading.ts)이 모두 이 목록에서 나온다.
 * 언어를 더하면 빠진 문구·사전은 타입 오류로 드러나고, Worker도 같은 목록으로 요청을 받는다.
 */
export const LOCALES = ['ko', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}
