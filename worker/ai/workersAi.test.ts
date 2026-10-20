import { describe, expect, it } from 'vitest'
import { createWorkersAiProvider, detectImageMime, PORTRAIT_MODEL, PORTRAIT_SIZE } from './workersAi.ts'

const JPEG = '/9j/4AAQSkZJRgABAQ'
const PNG = 'iVBORw0KGgoAAAANSUhEUg'

describe('createWorkersAiProvider', () => {
  it('모델에 프롬프트·씨앗·크기를 넘기고 형식에 맞는 data URL로 감싼다', async () => {
    const calls: unknown[] = []
    const fakeAi = {
      run: async (model: string, input: unknown) => {
        calls.push([model, input])
        return { image: JPEG }
      },
    } as unknown as Ai
    const provider = createWorkersAiProvider(fakeAi)
    const output = await provider.generatePortrait({ prompt: 'portrait', seed: 42 })
    expect(output.image).toBe(`data:image/jpeg;base64,${JPEG}`)
    expect(calls[0]).toEqual([PORTRAIT_MODEL, { prompt: 'portrait', seed: 42, width: PORTRAIT_SIZE, height: PORTRAIT_SIZE }])
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
