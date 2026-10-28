import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = resolve(__dirname, 'src/shared')

export default defineConfig(({ mode }) => {
  // From .env locally and from the environment in CI. Baked in as constants
  // rather than read through import.meta.env, which the CommonJS main
  // tsconfig does not allow. A build without them simply has no Google
  // Calendar section.
  const env = loadEnv(mode)

  return {
    main: {
      resolve: { alias: { '@shared': shared } },
      define: {
        __GOOGLE_CLIENT_ID__: JSON.stringify(env.MAIN_VITE_GOOGLE_CLIENT_ID ?? ''),
        __GOOGLE_CLIENT_SECRET__: JSON.stringify(env.MAIN_VITE_GOOGLE_CLIENT_SECRET ?? '')
      },
      plugins: [externalizeDepsPlugin()]
    },
    preload: {
      resolve: { alias: { '@shared': shared } },
      plugins: [externalizeDepsPlugin()]
    },
    renderer: {
      root: resolve(__dirname, 'src/renderer'),
      resolve: {
        alias: {
          '@shared': shared,
          '@renderer': resolve(__dirname, 'src/renderer/src')
        }
      },
      build: {
        // electron-vite leaves minification off by default; the renderer is
        // parsed on every launch, so it is worth turning on here.
        minify: 'esbuild',
        rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } }
      },
      plugins: [react(), tailwindcss()]
    }
  }
})
