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

/**
 * 브라우저로 내려가는 번들에 든 의존성(react, react-dom, scheduler — MIT)의 라이선스 원문 파일. dist/client 에 생겨 이 경로로 함께 서빙된다.
 * MIT 는 모든 사본에 저작권 고지와 허락 문구를 요구하는데, 압축(minify)은 라이선스 주석까지 지운다(033).
 */
const THIRD_PARTY_LICENSES_FILE = 'third-party-licenses.txt'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare({ viteEnvironment: { name: 'worker' } }), htmlConstants()],
  environments: {
    // 클라이언트만. Worker 번들은 서버에서만 돌고 사용자에게 배포되지 않는다.
    client: {
      build: {
        // 번들에 든 node_modules 패키지의 LICENSE 원문을 모아 한 파일로 낸다.
        license: { fileName: THIRD_PARTY_LICENSES_FILE },
        rolldownOptions: {
          output: {
            // 패키지 자체의 @license 머리 주석(저작권자 표기)을 남기고, 원문 파일 위치를 각 JS 맨 앞에 알린다.
            comments: { legal: true },
            banner: `/*! Third-party licenses: /${THIRD_PARTY_LICENSES_FILE} */`,
          },
        },
      },
    },
  },
})
