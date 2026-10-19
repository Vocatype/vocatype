export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type ResolvedTheme = 'light' | 'dark'

/** 사용자 선택과 시스템 설정을 합쳐 실제 적용할 테마를 정한다. */
export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

/** 토글 버튼이 순환하는 순서: 시스템 → 라이트 → 다크 → 시스템. */
export function nextPreference(preference: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(preference)
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] ?? 'system'
}
