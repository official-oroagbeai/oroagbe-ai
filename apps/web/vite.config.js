import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png'], // Reference the PNG file
      manifest: {
        name: 'OroAgbeAI',
        short_name: 'OroAgbe',
        description: 'Yoruba AI Farming Assistant',
        theme_color: '#15803d', 
        background_color: '#f9fafb', 
        display: 'standalone', 
        icons: [
          {
            src: 'icon.png',
            sizes: '192x192 512x512', // standard PWA launch dimensions
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'] // Ensure the browser caches the new branding
      }
    })
  ],
  server: {
    port: 5173,
    host: true,
  }
})