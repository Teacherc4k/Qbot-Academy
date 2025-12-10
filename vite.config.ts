import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative paths for assets (critical for GitHub Pages)
  build: {
    outDir: 'docs', // Outputs to 'docs' folder so you can select it in GitHub Pages settings
    emptyOutDir: true,
  },
  define: {
    // This allows process.env.API_KEY to work in the browser code
    // Added fallback to empty string to prevent build errors if env var is missing
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  }
})