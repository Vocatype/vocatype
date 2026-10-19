import type { ApiConfigResponse, ApiErrorResponse, PortraitResponse } from '../shared/api.ts'
import { buildPortraitPrompt } from '../shared/catalog.ts'
import { SERVICE_NAME } from '../shared/config.ts'
import { selectProvider } from './ai/select.ts'
import { parsePortraitRequest } from './portrait.ts'

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

function error(code: ApiErrorResponse['error'], status: number): Response {
  return json({ error: code } satisfies ApiErrorResponse, status)
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const provider = selectProvider(env)

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: SERVICE_NAME, time: new Date().toISOString() })
    }

    if (url.pathname === '/api/config' && request.method === 'GET') {
      const config: ApiConfigResponse = {
        provider: provider.name,
        features: { portrait: provider.supportsPortrait },
      }
      return json(config)
    }

    if (url.pathname === '/api/portrait' && request.method === 'POST') {
      const parsed = await parsePortraitRequest(request)
      if (!parsed.ok) return error(parsed.error, parsed.error === 'too_large' ? 413 : 400)
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
