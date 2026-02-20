import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build v2026.01.03.3 - Debug plants page issue
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-v20260103-[hash].js`,
        chunkFileNames: `assets/[name]-v20260103-[hash].js`,
        assetFileNames: `assets/[name]-v20260103-[hash].[ext]`
      }
    }
  },
})
