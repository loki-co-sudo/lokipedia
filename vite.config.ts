import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'lokipedia',
        short_name: 'lokipedia',
        description: 'AIが解説と4択クイズを生成する共有辞書',
        lang: 'ja',
        display: 'standalone',
        start_url: '/',
        theme_color: '#0ea5e9',
        background_color: '#f8fafc',
        // アイコンは Phase 5 で public/ に追加する（docs/ROADMAP.md 参照）
        icons: [],
        // スマホの共有ボタン → /add に title/text/url が渡る（インストール済み PWA のみ有効）
        share_target: {
          action: '/add',
          method: 'GET',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
          },
        },
      },
    }),
  ],
})
