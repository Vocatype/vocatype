import { afterEach, describe, expect, it, vi } from 'vitest'
import { PORTRAIT_SERVER_TIMEOUT_MS } from '../../shared/api.ts'
import {
  buildImageRequest,
  createOpenAiImageProvider,
  DEFAULT_IMAGE_MODEL,
  isImageModel,
  OPENAI_IMAGES_URL,
  OPENAI_PORTRAIT_QUALITY,
  OPENAI_PORTRAIT_SIZE,
  resolveImageModel,
} from './openaiImage.ts'

const JPEG = '/9j/4AAQSkZJRgABAQ'

/** OpenAI 이미지 응답 흉내. GPT 이미지 모델은 언제나 b64_json 으로 돌려준다. */
function imagesResponse(b64: string | undefined) {
  return Response.json({ created: 1, data: b64 === undefined ? [] : [{ b64_json: b64 }], output_format: 'jpeg', usage: { input_tokens: 80, output_tokens: 439 } })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildImageRequest', () => {
  it('프롬프트·모델과 고정 크기·품질·jpeg 형식만 보내고 seed 는 보내지 않는다', () => {
    const body = buildImageRequest({ prompt: 'portrait', seed: 42 }, DEFAULT_IMAGE_MODEL)
    expect(body).toEqual({ model: 'gpt-image-2.5-flare', prompt: 'portrait', n: 1, size: '1024x1024', quality: 'medium', output_format: 'jpeg', output_compression: 90 })
    expect(body).not.toHaveProperty('seed')
    expect(OPENAI_PORTRAIT_SIZE).toBe('1024x1024')
    expect(OPENAI_PORTRAIT_QUALITY).toBe('medium')
  })
})

describe('createOpenAiImageProvider', () => {
  it('Bearer 키로 이미지 생성 엔드포인트를 부르고 data URL 로 감싼다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => imagesResponse(JPEG))
    const provider = createOpenAiImageProvider({ apiKey: 'sk-test', model: 'gpt-image-2', fetch: fetchMock as unknown as typeof fetch })
    expect(provider.name).toBe('openai')
    expect(provider.supportsPortrait).toBe(true)
    await expect(provider.generatePortrait({ prompt: 'portrait', seed: 7 })).resolves.toEqual({ image: `data:image/jpeg;base64,${JPEG}` })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe(OPENAI_IMAGES_URL)
    expect(init?.method).toBe('POST')
    const headers = new Headers(init?.headers as HeadersInit)
    expect(headers.get('authorization')).toBe('Bearer sk-test')
    expect(headers.get('content-type')).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'gpt-image-2', prompt: 'portrait' })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('기본 상한(PORTRAIT_SERVER_TIMEOUT_MS)의 신호를 fetch 에 건다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    let seen: AbortSignal | null | undefined
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen = init?.signal
      return imagesResponse(JPEG)
    })
    await createOpenAiImageProvider({ apiKey: 'sk-test', fetch: fetchMock as unknown as typeof fetch }).generatePortrait({ prompt: 'p', seed: 1 })
    expect(timeout).toHaveBeenCalledWith(PORTRAIT_SERVER_TIMEOUT_MS)
    expect(seen).toBe(timeout.mock.results[0]?.value)
  })

  // 라우트가 제공자 예외를 503 provider_failed 로 바꾸는 경로는 worker/index.test.ts 가 맡는다.
  it('응답이 끝나지 않으면 상한에서 신호로 끊겨 실패한다', async () => {
    const hanging = (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    const provider = createOpenAiImageProvider({ apiKey: 'sk-test', timeoutMs: 20, fetch: hanging as unknown as typeof fetch })
    await expect(provider.generatePortrait({ prompt: 'p', seed: 1 })).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  it('실패 응답은 상태와 오류 코드만 담아 던진다(본문 메시지는 싣지 않는다)', async () => {
    const blocked = async () => Response.json({ error: { code: 'moderation_blocked', type: 'image_generation_user_error', message: 'secret-detail' } }, { status: 400 })
    const error = await createOpenAiImageProvider({ apiKey: 'sk-test', fetch: blocked as unknown as typeof fetch }).generatePortrait({ prompt: 'p', seed: 1 }).catch((cause: unknown) => cause)
    expect(error).toMatchObject({ name: 'OpenAiError', message: 'HTTP 400 moderation_blocked' })
    expect(String((error as Error).message)).not.toContain('secret-detail')
    // 코드가 없으면 type, 본문이 JSON 이 아니면 상태만.
    const quota = async () => Response.json({ error: { code: null, type: 'insufficient_quota', message: 'x' } }, { status: 429 })
    await expect(createOpenAiImageProvider({ apiKey: 'sk-test', fetch: quota as unknown as typeof fetch }).generatePortrait({ prompt: 'p', seed: 1 })).rejects.toThrow('HTTP 429 insufficient_quota')
    const html = async () => new Response('<html>bad gateway</html>', { status: 502 })
    await expect(createOpenAiImageProvider({ apiKey: 'sk-test', fetch: html as unknown as typeof fetch }).generatePortrait({ prompt: 'p', seed: 1 })).rejects.toThrow(/^HTTP 502$/)
  })

  it('이미지가 없거나 알 수 없는 형식이면 null', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const empty = async () => imagesResponse(undefined)
    await expect(createOpenAiImageProvider({ apiKey: 'sk-test', fetch: empty as unknown as typeof fetch }).generatePortrait({ prompt: 'p', seed: 1 })).resolves.toEqual({ image: null })
    const weird = async () => imagesResponse('PD94bWwg')
    await expect(createOpenAiImageProvider({ apiKey: 'sk-test', fetch: weird as unknown as typeof fetch }).generatePortrait({ prompt: 'p', seed: 1 })).resolves.toEqual({ image: null })
  })

  it('비용 추적용 토큰 수만 로그에 남긴다(프롬프트 없음)', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const ok = async () => imagesResponse(JPEG)
    await createOpenAiImageProvider({ apiKey: 'sk-test', fetch: ok as unknown as typeof fetch }).generatePortrait({ prompt: 'secret-prompt', seed: 1 })
    expect(info).toHaveBeenCalledExactlyOnceWith('[portrait] openai gpt-image-2.5-flare in=80 out=439')
  })
})

describe('isImageModel', () => {
  it('gpt-image- 식별자만 통과하고, 나머지는 기본 모델로 해석한다', () => {
    expect(isImageModel('gpt-image-2.5-flare')).toBe(true)
    expect(isImageModel('gpt-image-2-2026-04-21')).toBe(true)
    expect(isImageModel('dall-e-3')).toBe(false)
    expect(isImageModel('gpt-image-')).toBe(false)
    expect(isImageModel('GPT-image-2')).toBe(false)
    expect(isImageModel(42)).toBe(false)
    expect(resolveImageModel(undefined)).toBe(DEFAULT_IMAGE_MODEL)
    expect(resolveImageModel('dall-e-3')).toBe(DEFAULT_IMAGE_MODEL)
    expect(resolveImageModel('gpt-image-2')).toBe('gpt-image-2')
  })
})
