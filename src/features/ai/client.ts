import {
  CAPTION_MAX_CHARS,
  PORTRAIT_IMAGE_MAX_CHARS,
  READING_AXIS_KEYS,
  READING_CLIENT_TIMEOUT_MS,
  READING_MAX_CHARS,
  type ApiConfigResponse,
  type PortraitRequest,
  type PortraitResponse,
  type ReadingAxes,
  type ReadingAxisKey,
  type ReadingRequest,
  type ReadingResponse,
} from '../../../shared/api'
import type { Locale } from '../../i18n/locales'

const CONFIG_TIMEOUT_MS = 5000
const PORTRAIT_TIMEOUT_MS = 60000

let configPromise: Promise<ApiConfigResponse> | null = null

const OFFLINE_CONFIG: ApiConfigResponse = { provider: 'mock', textProviders: [], features: { portrait: false, reading: false } }

/** 서버가 만든 목소리 리딩. locale 은 생성 시점의 화면 언어다. */
export interface VoiceReading {
  locale: Locale
  reading: string
  caption: string
}

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

/** 분석 축을 요청 형식으로 바꾼다. 0..1로 자르고 소수 둘째 자리로 반올림해 필요 이상의 정밀도를 보내지 않는다. */
export function toReadingAxes(axes: Record<ReadingAxisKey, number>): ReadingAxes {
  const out = {} as ReadingAxes
  for (const key of READING_AXIS_KEYS) {
    const value = Number.isFinite(axes[key]) ? axes[key] : 0.5
    out[key] = Math.round(Math.min(1, Math.max(0, value)) * 100) / 100
  }
  return out
}

/**
 * 목소리 리딩 요청. 타입 코드, 반올림한 여섯 축, 언어만 보낸다(음성은 절대 보내지 않는다).
 * 실패·타임아웃·이상한 응답이면 null을 돌려주고 호출자는 카탈로그의 고정 설명으로 진행한다.
 * 서버 체인이 모두 실패해 모의 고정 문구가 온 경우(provider 'mock')도 리딩이 없는 것으로 본다.
 */
export async function requestReading(request: ReadingRequest, signal?: AbortSignal): Promise<VoiceReading | null> {
  try {
    const response = await fetchJson<ReadingResponse>(
      '/api/reading',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) },
      // Worker 체인 예산보다 길다(shared/api.ts의 리딩 시간 규칙). 체인이 늦어도 예산 안에 mock 으로 답하므로 그 답을 받고 끝난다.
      READING_CLIENT_TIMEOUT_MS,
      signal,
    )
    if (response.provider === 'mock') return null
    const reading = typeof response.reading === 'string' ? response.reading.replace(/\s+/g, ' ').trim() : ''
    const caption = typeof response.caption === 'string' ? response.caption.replace(/\s+/g, ' ').trim() : ''
    if (!reading || reading.length > READING_MAX_CHARS || !caption || caption.length > CAPTION_MAX_CHARS) return null
    return { locale: request.locale, reading, caption }
  } catch {
    return null
  }
}

/** 테스트용. 캐시를 비운다. */
export function resetAiConfigCache() {
  configPromise = null
}
