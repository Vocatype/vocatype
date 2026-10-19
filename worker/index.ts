import type { ApiConfigResponse, ApiErrorResponse, PortraitResponse } from '../shared/api.ts'
import { buildPortraitPrompt } from '../shared/catalog.ts'
import { SERVICE_NAME } from '../shared/config.ts'
import { selectProvider } from './ai/select.ts'
import { parsePortraitRequest } from './portrait.ts'

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

/**
 * 속도 제한. Workers Rate Limiting 바인딩이 설정돼 있을 때만 동작한다.
 * 키는 접속 IP이며 제한 판단에만 순간적으로 쓰고 어디에도 저장하지 않는다.
 */
async function isRateLimited(env: Env, request: Request): Promise<boolean> {
  const limiter = (env as { PORTRAIT_LIMITER?: RateLimit }).PORTRAIT_LIMITER
  if (!limiter) return false
  const key = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const { success } = await limiter.limit({ key })
  return !success
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
      const config: ApiConfigResponse = {
        provider: provider.name,
        features: { portrait: provider.supportsPortrait },
      }
      return json(config)
    }

    if (url.pathname === '/api/portrait') {
      if (method !== 'POST') return methodNotAllowed('POST')
      if (isCrossSite(request)) return error('forbidden', 403)
      if (await isRateLimited(env, request)) return error('rate_limited', 429, { 'retry-after': '60' })
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
      } catch {
        // 제공자 오류의 세부 내용은 노출하지 않는다. 클라이언트는 자리표시 초상으로 진행한다.
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
