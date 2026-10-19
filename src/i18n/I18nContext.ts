import { createContext } from 'react'
import type { TranslateParams } from './format'
import type { Locale } from './locales'
import type { MessageKey } from './messages'

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, params?: TranslateParams) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)
