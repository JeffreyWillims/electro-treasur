import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Поддержка абсолютных путей для DDD/FSD архитектуры
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true, // Fail-fast если порт занят
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false, // Игнорируем проверку SSL для локального PgBouncer
        // Добавляем обработку ошибок прокси для отладки связи с FastAPI
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
        },
      },
    },
  },
  // Оптимизация сборки (Dependency Pre-bundling)
  optimizeDeps: {
    include: ['recharts', '@tanstack/react-query', 'lucide-react'],
  },
})