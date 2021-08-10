import { join } from 'path'
import { defineConfig } from 'vite'
import svelte from '@sveltejs/vite-plugin-svelte'
import graphql from '@rollup/plugin-graphql'
import yaml from '@rollup/plugin-yaml'
import atelier from '@atelier-wb/vite-plugin-svelte'

export default defineConfig({
  plugins: [
    svelte(),
    yaml(),
    graphql(),
    atelier({
      path: 'tests',
      // it has to be an absolute path
      setupPath: join(__dirname, 'tests', 'atelier-setup.js')
    })
  ],
  optimizeDeps: {
    exclude: ['@urql/svelte']
  },
  server: {
    open: true,
    proxy: {
      '/ws': {
        target: 'http://localhost:3001',
        ws: true
      },
      '^/(graphql|sse)/?': {
        target: 'http://localhost:3001'
      }
    }
  }
})
