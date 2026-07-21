/* eslint-disable */
// Отдельная конфигурация для тестов: НЕ тянем vite.config.ts, чтобы плагин
// VitePWA (Workbox/service worker) не запускался во время юнит-тестов.
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom', // нужен localStorage для gameRecords
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
