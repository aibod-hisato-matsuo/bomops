/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 開発時は Vite 経由で Django にプロキシし CORS を回避する
    // ポート8000が他プロジェクトと衝突する場合は BOMOPS_API_TARGET で差し替える
    proxy: {
      '/api': {
        target: process.env.BOMOPS_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
