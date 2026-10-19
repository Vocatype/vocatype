import { describe, expect, it } from 'vitest'
import { createWorkersAiProvider, PORTRAIT_MODEL } from './workersAi.ts'

describe('createWorkersAiProvider', () => {
  it('모델에 프롬프트·스텝·씨앗을 넘기고 base64를 data URL로 감싼다', async () => {
    const calls: unknown[] = []
    const fakeAi = {
      run: async (model: string, input: unknown) => {
        calls.push([model, input])
        return { image: 'QUJD' }
      },
    } as unknown as Ai
    const provider = createWorkersAiProvider(fakeAi)
    const output = await provider.generatePortrait({ prompt: 'portrait', seed: 42 })
    expect(output.image).toBe('data:image/jpeg;base64,QUJD')
    expect(calls[0]).toEqual([PORTRAIT_MODEL, { prompt: 'portrait', steps: 4, seed: 42 }])
  })

  it('이미지가 없으면 null', async () => {
    const fakeAi = { run: async () => ({}) } as unknown as Ai
    await expect(createWorkersAiProvider(fakeAi).generatePortrait({ prompt: 'p', seed: 1 })).resolves.toEqual({ image: null })
  })
})
