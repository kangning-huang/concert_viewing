import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Default: GitHub Pages project site.
// Side-page on kangning-huang.com: VITE_BASE=/joker-xue-3d/wuxi/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/concert_viewing/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    assetsInlineLimit: 4096,
  },
  server: {
    host: true,
    port: 5173,
  },
})
