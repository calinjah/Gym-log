import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // relative paths so the build works from any folder (e.g. GitHub Pages)
  plugins: [react()],
})
