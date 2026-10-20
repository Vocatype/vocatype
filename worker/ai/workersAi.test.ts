import { afterEach, describe, expect, it, vi } from 'vitest'
import { PORTRAIT_SERVER_TIMEOUT_MS } from '../../shared/api.ts'
import { createWorkersAiProvider, detectImageMime, PORTRAIT_MODEL, PORTRAIT_SIZE } from './workersAi.ts'

const JPEG = '/9j/4AAQSkZJRgABAQ'
const PNG = 'iVBORw0KGgoAAAANSUhEUg'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createWorkersAiProvider', () => {
  it('모델에 프롬프트·씨앗·크기를 넘기고 형식에 맞는 data URL로 감싼다', async () => {
    const calls: unknown[] = []
    const fakeAi = {
      run: async (model: string, input: unknown, options?: AiOptions) => {
        calls.push([model, input, options])
        return { image: JPEG }
      },
    } as unknown as Ai
    const provider = createWorkersAiProvider(fakeAi)
    const output = await provider.generatePortrait({ prompt: 'portrait', seed: 42 })
    expect(output.image).toBe(`data:image/jpeg;base64,${JPEG}`)
    expect(calls[0]).toEqual([PORTRAIT_MODEL, { prompt: 'portrait', seed: 42, width: PORTRAIT_SIZE, height: PORTRAIT_SIZE }, { signal: expect.any(AbortSignal) }])
  })

  it('기본 상한(PORTRAIT_SERVER_TIMEOUT_MS)의 신호를 바인딩 옵션으로 넘긴다', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    let seen: AiOptions | undefined
    const fakeAi = {
      run: async (_model: string, _input: unknown, options?: AiOptions) => {
        seen = options
        return { image: JPEG }
      },
    } as unknown as Ai
    await createWorkersAiProvider(fakeAi).generatePortrait({ prompt: 'p', seed: 1 })
    expect(timeout).toHaveBeenCalledWith(PORTRAIT_SERVER_TIMEOUT_MS)
    expect(seen?.signal).toBe(timeout.mock.results[0]?.value)
  })

  // 라우트가 제공자 예외를 503 provider_failed 로 바꾸는 경로는 worker/index.test.ts 의 '제공자가 실패하면 503' 테스트가 맡는다.
  it('바인딩이 끝나지 않으면 상한에서 신호로 끊겨 실패한다', async () => {
    // 신호를 존중하는 바인딩 흉내: 끝나지 않다가 신호가 오면 그 이유로 거부한다.
    const hangingAi = {
      run: (_model: string, _input: unknown, options?: AiOptions) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
        }),
    } as unknown as Ai
    await expect(createWorkersAiProvider(hangingAi, 20).generatePortrait({ prompt: 'p', seed: 1 })).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  it('PNG도 올바른 MIME으로, 이미지가 없거나 알 수 없는 형식이면 null', async () => {
    const png = createWorkersAiProvider({ run: async () => ({ image: PNG }) } as unknown as Ai)
    expect((await png.generatePortrait({ prompt: 'p', seed: 1 })).image).toBe(`data:image/png;base64,${PNG}`)
    const empty = createWorkersAiProvider({ run: async () => ({}) } as unknown as Ai)
    await expect(empty.generatePortrait({ prompt: 'p', seed: 1 })).resolves.toEqual({ image: null })
    const weird = createWorkersAiProvider({ run: async () => ({ image: 'PD94bWwg' }) } as unknown as Ai)
    await expect(weird.generatePortrait({ prompt: 'p', seed: 1 })).resolves.toEqual({ image: null })
  })
})

describe('detectImageMime', () => {
  it('매직 바이트로 형식을 가른다', () => {
    expect(detectImageMime(JPEG)).toBe('image/jpeg')
    expect(detectImageMime(PNG)).toBe('image/png')
    expect(detectImageMime('UklGRiQAAABXRUJQ')).toBe('image/webp')
    expect(detectImageMime('AAAA')).toBeNull()
  })
})
