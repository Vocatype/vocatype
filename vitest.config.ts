import { defineConfig } from 'vitest/config'

// 단위 테스트 전용 설정. Cloudflare 플러그인은 테스트 실행에 필요 없으므로 포함하지 않는다.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts', 'worker/**/*.test.ts'],
    environment: 'node',
  },
})
