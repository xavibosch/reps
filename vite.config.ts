import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Spotify rejects "localhost" in redirect URIs for the loopback flow, so
    // the dev server binds 127.0.0.1 and the registered URI must match it.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
