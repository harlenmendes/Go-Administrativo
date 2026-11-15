import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.png', 'logo.svg'],
      workbox: {
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/oauth2\//,
          /^\/login\/oauth2\//,
          /^\/logout/
        ]
      },
      manifest: {
        name: 'Go Administrativo | Go Fisioterapia',
        short_name: 'Go Admin',
        description: 'Acompanhamento de pacientes e fechamento de atendimentos da Go Fisioterapia',
        theme_color: '#1B3A4B',
        background_color: '#F5F7F6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/oauth2': 'http://localhost:3001',
      '/login/oauth2': 'http://localhost:3001',
      '/logout': 'http://localhost:3001',
    }
  }
})

