import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
// `vitest/config` en vez de `vite`: es el mismo `defineConfig` con el bloque
// `test` de las pruebas de componentes (T20) ya tipado.
import { defineConfig } from 'vitest/config'

// La app instalada abre en la cartelera, que es la cara del comprador: el
// manifest usa el fondo y el acento del tema oscuro cinematográfico
// (`tokens.scss`, entrada Theater/Cinema de la skill `ui-ux-pro-max`).
const FONDO_APP = '#0f0f23'
const COLOR_APP = '#ca8a04' // el dorado de reflector, único acento del sistema

export default defineConfig({
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
        background_color: FONDO_APP,
        theme_color: COLOR_APP,
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
