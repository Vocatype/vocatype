import { SERVICE_NAME } from '../shared/config.ts'

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

export default {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: SERVICE_NAME, time: new Date().toISOString() })
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'not_found' }, 404)
    }

    // /api/* 이외의 경로는 wrangler.jsonc의 run_worker_first 설정상 이 Worker에 도달하지 않는다.
    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler<Env>
