export type TranslateParams = Record<string, string | number>

/** `{name}` 꼴의 자리표시자를 params 값으로 치환한다. 값이 없는 자리표시자는 그대로 둔다. */
export function formatMessage(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  )
}
