import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works both at the domain root and under a
  // GitHub Pages project subpath (/<repo>/), e.g. when opened as a
  // Telegram Mini App.
  base: './',
  // Allow localtunnel (loca.lt) hostnames to reach the preview server
  // when testing the Telegram Mini App through a temporary tunnel.
  preview: {
    allowedHosts: ['.loca.lt']
  },
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              // The 3D portrait stack is lazy-loaded (Portrait3D),
              // so three.js must not land in the main vendor chunk.
              name: 'three-vendor',
              test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
              priority: 40,
            },
            {
              name: 'ui-vendor',
              test: /[\\/]node_modules[\\/](lucide-react|clsx)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
            },
            {
              name: 'game-engines',
              test: /[\\/]src[\\/].*Engine\.ts$/,
              priority: 5,
            },
            {
              name: 'game-content',
              test: /[\\/]src[\\/](content|data)[\\/]/,
              priority: 5,
            },
          ],
        },
      },
    },
  },
})
