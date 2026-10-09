import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './', // relative paths so the build works from any folder (e.g. GitHub Pages)
  plugins: [
    react(),
    // Service worker that stores the whole app on the device so it opens offline.
    // The manifest stays in public/manifest.webmanifest.
    VitePWA({ registerType: 'autoUpdate', manifest: false, workbox: { globPatterns: ['**/*.{js,css,html,svg,webmanifest}'] } }),
  ],
  test: {
    include: ['src/**/*.test.ts'], // e2e/ is run by Playwright
  },
})
