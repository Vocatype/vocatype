import type { MessageKey } from './ko'

/** 영어 사전. ko와 키가 하나라도 다르면 컴파일 오류가 난다. */
export const en = {
  'app.tagline': 'A portrait drawn by your voice',
  'shell.placeholder': 'The screens are being prepared.',
  'topbar.language': 'Language',
  'topbar.theme': 'Theme',
  'locale.ko': '한국어',
  'locale.en': 'English',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'privacy.note': 'No login, no cookies, no storage. Your recording never leaves your device.',
} satisfies Record<MessageKey, string>
