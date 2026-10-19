import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { SERVICE_NAME } from './shared/config.ts'

/** index.html 안의 %SERVICE_NAME% 을 상수 값으로 치환한다. 서비스 이름의 출처를 한 곳으로 유지하기 위한 플러그인. */
function htmlConstants(): Plugin {
  return {
    name: 'html-constants',
    transformIndexHtml: (html) => html.replaceAll('%SERVICE_NAME%', SERVICE_NAME),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare({ viteEnvironment: { name: 'worker' } }), htmlConstants()],
})
