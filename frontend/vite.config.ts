/* eslint-disable */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // SW обновляется сам при выходе новой сборки — без баннера «обновитесь».
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Citrine Vault',
        short_name: 'Citrine',
        description: 'Citrine Vault — управление личными финансами',
        lang: 'ru',
        theme_color: '#1C3F35',
        background_color: '#FDFBF7',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // Тот же арт с полным дном годится и как maskable (важное в центре).
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Оффлайн = только статическая оболочка. Финансовые данных (/api, /v1)
        // намеренно НЕ кэшируем: устаревший баланс офлайн опаснее его отсутствия.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/v1/],
        // На всякий случай — никакого рантайм-кэша для API.
        runtimeCaching: [],
      },
    }),
  ],
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
  // Тяжёлые страницы (recharts) подключены через React.lazy в App.tsx —
  // rolldown сам выносит их в отдельные чанки, которые не грузятся при старте.
  // Ручной manualChunks убран: на Vite 8 (rolldown) он затягивал React в чанк
  // charts и ломал ленивую загрузку (все чанки preload'ились со старта).
})