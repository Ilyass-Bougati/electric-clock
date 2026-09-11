import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = resolve(__dirname, 'src/shared')

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': shared } },
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
})
