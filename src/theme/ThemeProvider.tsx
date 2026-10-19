import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { getSystemDark, subscribeSystemDark } from './systemTheme'
import { resolveTheme, type ResolvedTheme, type ThemePreference } from './theme'
import { ThemeContext, type ThemeContextValue } from './ThemeContext'

/** 해석된 테마를 문서에 반영한다. CSS는 html[data-theme] 셀렉터로 토큰을 바꾼다. */
function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = resolved
  const background = getComputedStyle(root).getPropertyValue('--bg').trim()
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta && background) meta.content = background
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 저장하지 않는다. 방문할 때마다 'system'에서 시작하고 전환 값은 메모리에만 둔다.
  const [preference, setPreference] = useState<ThemePreference>('system')
  const systemDark = useSyncExternalStore(subscribeSystemDark, getSystemDark, () => false)
  const resolved = resolveTheme(preference, systemDark)

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
