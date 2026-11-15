/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base: the same build works on GitHub Pages (/vals-oyunu/) and on the Oracle host (/).
export default defineConfig({
  base: './',
  // Build stamp sent with usage events, so the report can tell which version an error came from.
  define: { __SURUM__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Vals',
        short_name: 'Vals',
        description: '1-2-3 ritmiyle sıçrayarak bütün taşları gez.',
        lang: 'tr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f3ee',
        theme_color: '#5b3cc4',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        navigateFallback: 'index.html',
        // The Oracle host serves the usage report and event endpoint under /api: never answer those with the game.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
