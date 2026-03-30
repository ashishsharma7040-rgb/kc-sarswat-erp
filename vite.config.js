import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],

      // ── Service Worker Strategy ─────────────────────────────────
      strategies: 'generateSW',

      workbox: {
        // Cache ALL app shell files
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],

        // Critical: makes browser treat it as real app, not webpage
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/supabase/],

        // Skip waiting — update immediately
        skipWaiting: true,
        clientsClaim: true,

        // Runtime caching rules
        runtimeCaching: [
          // Google Fonts — cache forever
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          // CDN scripts (pdfmake, xlsx) — stale while revalidate
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // Supabase API — NetworkFirst (try live, fall back to cache)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 }
            }
          }
        ]
      },

      // ── PWA Manifest — makes it installable as real app ────────
      manifest: {
        name: 'KC Sarswat ERP',
        short_name: 'KC ERP',
        description: 'Shree K C Sarswat Auto Fuel Station — Premium ERP',
        theme_color: '#060d18',
        background_color: '#060d18',

        // standalone = no browser chrome, looks 100% native
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],

        orientation: 'portrait',
        scope: '/',
        start_url: '/?source=pwa',
        lang: 'en-IN',
        categories: ['business', 'finance', 'productivity'],

        // ── Icons — must have maskable for Android ──
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],

        // ── Screenshots — required for Android install prompt ──
        screenshots: [
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'KC Sarswat ERP Dashboard'
          }
        ]
      }
    })
  ],

  base: '/',

  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ['react', 'react-dom'],
          charts:   ['recharts'],
          supabase: ['@supabase/supabase-js'],
        }
      }
    }
  }
})
