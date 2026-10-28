import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

// robots.txt for search engines. The sitemap is served by the backend, so its address comes from
// VITE_API_BASE_URL at build time rather than being typed into a file in public/.
function robotsTxt(apiBaseUrl: string | undefined): Plugin {
  const sitemap = apiBaseUrl?.trim().replace(/\/+$/, '')
  const text = ['User-agent: *', 'Allow: /', ...(sitemap ? ['', `Sitemap: ${sitemap}/sitemap.xml`] : []), ''].join('\n')

  return {
    name: 'storehatch-robots-txt',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: text })
    },
    configureServer(server) {
      server.middlewares.use('/robots.txt', (_request, response) => {
        response.setHeader('Content-Type', 'text/plain; charset=utf-8')
        response.end(text)
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), robotsTxt(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL)],
}))
