import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const threeSourceEntry = fileURLToPath(new URL('./node_modules/three/src/Three.js', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works both at the domain root and under a
  // GitHub Pages project subpath (/<repo>/), e.g. when opened as a
  // Telegram Mini App.
  base: './',
  // Allow localtunnel (loca.lt) hostnames to reach the dev/preview server
  // when testing through a temporary tunnel.
  server: {
    allowedHosts: ['.loca.lt']
  },
  preview: {
    allowedHosts: ['.loca.lt']
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [{ find: /^three$/, replacement: threeSourceEntry }],
  },
  build: {
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Keep the React runtime separate from the optional 3D scene graph.
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 50,
            },
            {
              // Three.js exposes its per-module source graph through the alias
              // above; cap this deferred group so its renderer stays below Vite's
              // warning threshold without pulling it into the initial bundle.
              // three-stdlib is deliberately absent: it imports `three`, and an
              // export graph that crosses the three-vendor/app boundary leaves a
              // class undefined at load ("a is not a constructor" from the
              // three scene at runtime). Keep it in its own chunk.
              name: 'three-vendor',
              test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
              priority: 40,
              maxSize: 300 * 1024,
            },
            {
              name: 'three-stdlib',
              test: /[\\/]node_modules[\\/]three-stdlib[\\/]/,
              priority: 30,
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
