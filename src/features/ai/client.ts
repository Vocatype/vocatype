import { PORTRAIT_IMAGE_MAX_CHARS, type ApiConfigResponse, type PortraitRequest, type PortraitResponse } from '../../../shared/api'

const CONFIG_TIMEOUT_MS = 5000
const PORTRAIT_TIMEOUT_MS = 60000

let configPromise: Promise<ApiConfigResponse> | null = null

const OFFLINE_CONFIG: ApiConfigResponse = { provider: 'mock', features: { portrait: false } }

async function fetchJson<T>(input: string, init: RequestInit, timeoutMs: number, outer?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onOuterAbort = () => controller.abort()
  outer?.addEventListener('abort', onOuterAbort, { once: true })
  try {
    if (outer?.aborted) controller.abort()
    const response = await fetch(input, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', onOuterAbort)
  }
}

/** 서버의 AI 설정. 세션 안에서 한 번만 가져온다. 실패하면 초상 기능이 꺼진 설정으로 본다. */
export function fetchAiConfig(): Promise<ApiConfigResponse> {
  if (!configPromise) {
    configPromise = fetchJson<ApiConfigResponse>('/api/config', { method: 'GET' }, CONFIG_TIMEOUT_MS).catch(() => {
      configPromise = null
      return OFFLINE_CONFIG
    })
  }
  return configPromise
}

/**
 * 초상 생성 요청. 타입 코드와 씨앗만 보낸다(음성은 절대 보내지 않는다).
 * 실패·타임아웃이면 null을 돌려주고 호출자는 자리표시 초상으로 진행한다.
 */
export async function requestPortrait(request: PortraitRequest, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetchJson<PortraitResponse>(
      '/api/portrait',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) },
      PORTRAIT_TIMEOUT_MS,
      signal,
    )
    const image = response.image
    // 서버 계약은 JPEG/PNG/WebP data URL뿐이다. 그 밖의 형식(SVG 등)과 비정상적으로 큰 응답은 버린다.
    if (typeof image !== 'string' || image.length > PORTRAIT_IMAGE_MAX_CHARS) return null
    return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) ? image : null
  } catch {
    return null
  }
}

/** 테스트용. 캐시를 비운다. */
export function resetAiConfigCache() {
  configPromise = null
}
