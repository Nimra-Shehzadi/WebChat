import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Polyfills Node.js built-ins (events, util, buffer, process, stream…)
    // Required by simple-peer and its dependencies (readable-stream, randombytes)
    nodePolyfills({
      include: ['events', 'util', 'process', 'buffer', 'stream'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  define: {
    global: 'globalThis',
  },
})
