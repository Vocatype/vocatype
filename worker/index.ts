import type { ApiConfigResponse, ApiErrorResponse, PortraitResponse, ReadingResponse } from '../shared/api.ts'
import { buildPortraitPrompt } from '../shared/catalog.ts'
import { SERVICE_NAME } from '../shared/config.ts'
import { selectProvider } from './ai/select.ts'
import { selectTextProvider } from './ai/textSelect.ts'
import { parsePortraitRequest } from './portrait.ts'
import { parseReadingRequest } from './reading.ts'

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store', ...headers },
  })
}

function error(code: ApiErrorResponse['error'], status: number, headers: Record<string, string> = {}): Response {
  return json({ error: code } satisfies ApiErrorResponse, status, headers)
}

function methodNotAllowed(allow: string): Response {
  return error('method_not_allowed', 405, { allow })
}

/** 다른 사이트의 페이지가 이 API를 부르는 것을 막는다. 브라우저가 보내는 Sec-Fetch-Site만 본다(없으면 통과). */
function isCrossSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  return site !== null && site !== 'same-origin' && site !== 'none'
}

type LimiterName = 'PORTRAIT_LIMITER' | 'READING_LIMITER'

/** 바인딩이 없는 환경(테스트 등)도 허용하므로 선택적으로 읽는다. */
function limiterOf(env: Env, name: LimiterName): RateLimit | undefined {
  return (env as Partial<Record<LimiterName, RateLimit>>)[name]
}

/**
 * 속도 제한. Workers Rate Limiting 바인딩이 설정돼 있을 때만 동작한다.
 * 키는 접속 IP이며 제한 판단에만 순간적으로 쓰고 어디에도 저장하지 않는다.
 */
async function isRateLimited(limiter: RateLimit | undefined, request: Request): Promise<boolean> {
  if (!limiter) return false
  const key = request.headers.get('cf-connecting-ip') ?? 'unknown'
  try {
    const { success } = await limiter.limit({ key })
    return !success
  } catch {
    // 바인딩 장애는 사용자 요청을 막지 않는다(fail-open). 남용 방지는 보조 수단이다.
    return false
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const method = request.method === 'HEAD' ? 'GET' : request.method

    if (url.pathname === '/api/health') {
      if (method !== 'GET') return methodNotAllowed('GET, HEAD')
      return json({ ok: true, service: SERVICE_NAME, time: new Date().toISOString() })
    }

    if (url.pathname === '/api/config') {
      if (method !== 'GET') return methodNotAllowed('GET, HEAD')
      const provider = selectProvider(env)
      const textProvider = selectTextProvider(env)
      const config: ApiConfigResponse = {
        provider: provider.name,
        textProvider: textProvider.name,
        features: { portrait: provider.supportsPortrait, reading: textProvider.supportsReading },
      }
      return json(config)
    }

    if (url.pathname === '/api/portrait') {
      if (method !== 'POST') return methodNotAllowed('POST')
      if (isCrossSite(request)) return error('forbidden', 403)
      if (await isRateLimited(limiterOf(env, 'PORTRAIT_LIMITER'), request)) return error('rate_limited', 429, { 'retry-after': '60' })
      const parsed = await parsePortraitRequest(request)
      if (!parsed.ok) return error(parsed.error, parsed.error === 'too_large' ? 413 : 400)
      const provider = selectProvider(env)
      try {
        const output = await provider.generatePortrait({
          prompt: buildPortraitPrompt(parsed.value.typeCode),
          seed: parsed.value.seed,
        })
        const response: PortraitResponse = { image: output.image, provider: provider.name }
        return json(response)
      } catch (cause) {
        // 제공자 오류의 세부 내용은 응답에 노출하지 않는다(클라이언트는 자리표시 초상으로 진행).
        // 운영 진단을 위해 오류 종류와 메시지만 로그에 남긴다. 사용자 데이터는 포함되지 않는다.
        console.error('[portrait] provider failed:', cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause))
        return error('provider_failed', 503)
      }
    }

    if (url.pathname === '/api/reading') {
      if (method !== 'POST') return methodNotAllowed('POST')
      if (isCrossSite(request)) return error('forbidden', 403)
      if (await isRateLimited(limiterOf(env, 'READING_LIMITER'), request)) return error('rate_limited', 429, { 'retry-after': '60' })
      const parsed = await parseReadingRequest(request)
      if (!parsed.ok) return error(parsed.error, parsed.error === 'too_large' ? 413 : 400)
      const provider = selectTextProvider(env)
      try {
        // 프롬프트는 제공자 안에서 서버가 만든다. 요청 본문의 타입 코드·축·언어만 쓰인다.
        const output = await provider.generateReading(parsed.value)
        const response: ReadingResponse = { reading: output.reading, caption: output.caption, provider: provider.name }
        return json(response)
      } catch (cause) {
        // 세부 내용은 응답에 노출하지 않는다(클라이언트는 카탈로그 설명으로 진행). 로그에는 오류 종류와 메시지만 남긴다.
        console.error('[reading] provider failed:', cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause))
        return error('provider_failed', 503)
      }
    }

    if (url.pathname.startsWith('/api/')) {
      return error('not_found', 404)
    }

    // /api/* 이외의 경로는 wrangler.jsonc의 run_worker_first 설정상 이 Worker에 도달하지 않는다.
    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler<Env>
