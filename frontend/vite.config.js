import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Frontend ki /api requests backend ko forward hongi.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
})