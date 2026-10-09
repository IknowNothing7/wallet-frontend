import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend's CORS config allows http://localhost:3000. In development, API calls go to /backend
// and are proxied to the Spring app, so no CORS is involved; in production set VITE_API_URL instead.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/backend': {
        target: process.env.BACKEND_URL ?? 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
    },
  },
})
