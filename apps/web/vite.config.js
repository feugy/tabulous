import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import graphql from '@rollup/plugin-graphql'
import yaml from '@rollup/plugin-yaml'
import atelier from '@atelier-wb/vite-plugin-atelier'
import windi from 'vite-plugin-windicss'

export default defineConfig({
  plugins: [
    windi(),
    svelte(),
    yaml(),
    graphql(),
    atelier({
      url: '/atelier/',
      path: 'tests',
      setupPath: './atelier/setup',
      uiSettings: { backgrounds: ['white', '', '#e0e0e0', '#a0a0a0', 'black'] }
    })
  ],
  optimizeDeps: {
    exclude: ['@urql/svelte', '@atelier-wb/ui']
  },
  server: {
    open: true,
    proxy: {
      '/ws': {
        target: 'http://localhost:3001',
        ws: true
      },
      '/graphql': {
        target: 'http://localhost:3001',
        ws: true
      },
      '^/graphql/?': {
        target: 'http://localhost:3001'
      }
    }
  }
})
