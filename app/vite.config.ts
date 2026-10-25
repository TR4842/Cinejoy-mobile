import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  '/api': {
    target: 'http://127.0.0.1:8787',
    changeOrigin: true,
    secure: false,
  },
}

// base: './' keeps asset URLs relative so the same build works inside the
// Capacitor Android WebView (https://localhost) and as a hosted PWA.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
    proxy,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
  },
})
