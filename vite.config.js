import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        trust: resolve(__dirname, 'trust/index.html'),
        pricing: resolve(__dirname, 'pricing/index.html'),
        product: resolve(__dirname, 'product/index.html'),
        mirror: resolve(__dirname, 'mirror/index.html'),
        consulting: resolve(__dirname, 'consulting/index.html'),
        enterprise: resolve(__dirname, 'enterprise/index.html'),
        research: resolve(__dirname, 'research/index.html'),
        cockpit: resolve(__dirname, 'cockpit/index.html'),
        cockpitOps: resolve(__dirname, 'cockpit/ops/index.html'),
        privacy: resolve(__dirname, 'privacy/index.html'),
        terms: resolve(__dirname, 'terms/index.html'),
      },
    },
  },
})
