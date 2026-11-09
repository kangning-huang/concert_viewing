import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages base path for https://kangning-huang.github.io/concert_viewing/
export default defineConfig({
  plugins: [react()],
  base: '/concert_viewing/',
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
