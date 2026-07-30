/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Two pages: / is the marketing landing, /app.html is the app itself
// (served as /app in production via Vercel cleanUrls).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'FretPath — Metal',
        short_name: 'FretPath',
        description:
          'Skill-tree + spaced-repetition guitar practice. Pick a goal, follow the lit path.',
        theme_color: '#0c0a09',
        background_color: '#0c0a09',
        display: 'standalone',
        start_url: '/app',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Offline navigations land in the app (the landing page is a
        // marketing surface; the app is what must work in airplane mode).
        navigateFallback: '/app.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        landing: 'index.html',
        app: 'app.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
