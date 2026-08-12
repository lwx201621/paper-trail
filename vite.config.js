import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers', 'echarts-for-react/lib/core'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
