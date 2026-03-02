import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build v2026.03.02 - Code splitting for faster initial load
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
        entryFileNames: `assets/[name]-v20260302-[hash].js`,
        chunkFileNames: `assets/[name]-v20260302-[hash].js`,
        assetFileNames: `assets/[name]-v20260302-[hash].[ext]`,
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Chart libraries into their own chunk (recharts + d3 deps are large)
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
              return 'charts'
            }
            // Core React runtime into a stable chunk
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)/.test(id)) {
              return 'react-vendor'
            }
            // Everything else into a shared vendor chunk
            return 'vendor'
          }
        }
      }
    }
  },
})
