import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatMessage, type TranslateParams } from './format'
import { I18nContext, type I18nContextValue } from './I18nContext'
import { detectBrowserLocale, type Locale } from './locales'
import { messages, type MessageKey } from './messages'

interface Props {
  children: ReactNode
  /** 테스트나 미리보기에서 감지 결과를 덮어쓸 때만 사용한다. */
  initialLocale?: Locale
}

export function I18nProvider({ children, initialLocale }: Props) {
  const [locale, setLocale] = useState<Locale>(() => initialLocale ?? detectBrowserLocale())

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) => formatMessage(messages[locale][key], params),
    [locale],
  )

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, t])

  return <I18nContext value={value}>{children}</I18nContext>
}
