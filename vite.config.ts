import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5178,
    // Proxy Django paths to the local backend container so the dev server is
    // same-origin (no CORS, works through preview proxies and other hosts).
    proxy: {
      '/api': { target: 'http://127.0.0.1:8001', changeOrigin: true },
      '/admin': { target: 'http://127.0.0.1:8001', changeOrigin: true },
      '/static': { target: 'http://127.0.0.1:8001', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8001', changeOrigin: true },
    },
  },
})