import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
// `vitest/config` en vez de `vite`: es el mismo `defineConfig` con el bloque
// `test` de las pruebas de componentes (T20) ya tipado.
import { defineConfig } from 'vitest/config'

// Colores del tema Carbon `g10` (@carbon/react), para que el manifest y la
// barra del navegador combinen con la app (CLAUDE.md §8: Carbon como
// inspiración de la PWA).
const FONDO_TEMA_G10 = '#f4f4f4'
const COLOR_TEMA_G10 = '#0f62fe' // Blue 60, el interactivo primario de Carbon

export default defineConfig({
  // El minificador de CSS por defecto (lightningcss) todavía no entiende el
  // `@position-try` que emite el SCSS de @carbon/react, y esta versión de
  // Vite no trae esbuild instalado como alternativa. Se apaga la
  // minificación de CSS por ahora; no afecta al cascarón de T18 y puede
  // revisitarse cuando el ecosistema se ponga al día.
  build: { cssMinify: false },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Cine Variedades',
        short_name: 'Cine Variedades',
        description: 'Venta de entradas del Cine Variedades: cartelera, butacas y compra por internet.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: FONDO_TEMA_G10,
        theme_color: COLOR_TEMA_G10,
        icons: [
          { src: '/icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icono-mascara.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      // Sin venta offline (RNF-3, decisión de CLAUDE.md §8): el service worker
      // instala la app, pero nunca cachea /api — cada pedido de dominio va
      // siempre a la red. Sin runtimeCaching no hay ninguna ruta cacheada
      // más allá del cascarón (HTML/CSS/JS) que Workbox precachea por defecto.
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  // Pruebas de componentes con testing-library (T20): las pantallas de
  // taquilla y puerta mueven dinero y entradas, así que se verifican como
  // las ve quien opera —por texto y por rol accesible—, no por detalles de
  // implementación. El servidor tiene su propia suite en `cine-variedades/`.
  test: {
    environment: 'jsdom',
    include: ['src/**/*.prueba.{ts,tsx}'],
    globals: true,
    setupFiles: ['./src/configuracion-pruebas.ts'],
  },
})
