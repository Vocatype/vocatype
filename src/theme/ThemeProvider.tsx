import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { getSystemDark, subscribeSystemDark } from './systemTheme'
import { resolveTheme, type ThemePreference } from './theme'
import { ThemeContext, type ThemeContextValue } from './ThemeContext'

/**
 * 선택 값을 문서에 반영한다.
 * CSS는 html[data-theme='light'|'dark']로 color-scheme을 고정하고, 'system'이면 시스템 설정을 따른다.
 * 브라우저 UI 색(theme-color)은 실제 적용된 body 배경색으로 맞춘다.
 */
function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference
  const background = getComputedStyle(document.body).backgroundColor
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = background
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 저장하지 않는다. 방문할 때마다 'system'에서 시작하고 전환 값은 메모리에만 둔다.
  const [preference, setPreference] = useState<ThemePreference>('system')
  const systemDark = useSyncExternalStore(subscribeSystemDark, getSystemDark, () => false)
  const resolved = resolveTheme(preference, systemDark)

  useEffect(() => {
    applyTheme(preference)
    // systemDark는 본문에서 쓰지 않지만, preference가 'system'일 때 OS 테마가 바뀌면
    // theme-color 메타를 실제 배경색으로 다시 맞춰야 하므로 의존성에 둔다.
  }, [preference, systemDark])

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
