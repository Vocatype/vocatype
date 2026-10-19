const DARK_QUERY = '(prefers-color-scheme: dark)'

export function getSystemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(DARK_QUERY).matches
}

/** useSyncExternalStore 용 구독 함수. 시스템 테마가 바뀌면 onChange를 부른다. */
export function subscribeSystemDark(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
