/** 한국어 사전. 메시지 키의 원본이며, 다른 언어 사전은 이 키 집합을 모두 채워야 한다. */
export const ko = {
  'app.tagline': '목소리로 그리는 나의 초상',
  'shell.placeholder': '화면을 준비하고 있습니다.',
  'topbar.language': '언어',
  'topbar.theme': '테마',
  'locale.ko': '한국어',
  'locale.en': 'English',
  'theme.system': '시스템 설정',
  'theme.light': '라이트',
  'theme.dark': '다크',
  'privacy.note': '로그인도, 쿠키도, 저장도 없습니다. 녹음은 기기 안에서만 처리됩니다.',
} as const

export type MessageKey = keyof typeof ko
