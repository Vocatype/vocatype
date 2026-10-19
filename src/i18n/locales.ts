export const LOCALES = ['ko', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/**
 * 브라우저 언어 목록(navigator.languages)에서 지원하는 첫 로케일을 고른다.
 * 저장된 값은 사용하지 않으며, 방문할 때마다 이 함수로만 결정한다.
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0] ?? ''
    if (isLocale(base)) return base
  }
  return DEFAULT_LOCALE
}

/** 현재 브라우저 환경에서 로케일을 감지한다. 비브라우저 환경이면 기본값. */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  return detectLocale(languages)
}
