import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import manifest from './manifest'

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rolldownOptions: {
      // CRXJS content-script hashes depend on the checkout path.
      output: {
        chunkFileNames: (chunk) =>
          chunk.name === 'src-content-index.ts' ? 'assets/[name].js' : 'assets/[name]-[hash].js',
      },
    },
  },
})
