import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  logLevel: 'error', // Suppress warnings, only show errors
  // GitHub Pages serves this repo under /FutureTrackAI-V2/ - only apply that
  // base path for production builds so local dev keeps using "/".
  base: mode === 'production' ? '/FutureTrackAI-V2/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
