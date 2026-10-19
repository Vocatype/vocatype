import type { AiProvider } from './types.ts'

/** 모의 제공자. 이미지를 만들지 않고 null을 돌려준다. 결과 화면은 자리표시 초상을 쓴다. */
export const mockProvider: AiProvider = {
  name: 'mock',
  supportsPortrait: false,
  async generatePortrait() {
    return { image: null }
  },
}
