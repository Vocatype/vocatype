import type { Locale } from '../locales'
import { en } from './en'
import { ko, type MessageKey } from './ko'

export type { MessageKey }

export const messages: Record<Locale, Record<MessageKey, string>> = { ko, en }
