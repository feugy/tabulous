// @ts-check
import atelier from '@atelier-wb/vite-plugin-atelier'
import graphql from '@rollup/plugin-graphql'
import yaml from '@rollup/plugin-yaml'
import { sveltekit } from '@sveltejs/kit/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { svelteSVG } from 'rollup-plugin-svelte-svg'
import { defineConfig } from 'vite'
import windi from 'vite-plugin-windicss'

// This file is used by
// - vite
export default defineConfig(({ mode }) => ({
  envPrefix: 'WEB_',
  plugins: [
    basicSsl(),
    sveltekit(),
    windi(),
    svelteSVG({ enforce: 'pre' }),
    yaml(),
    graphql(),
    atelier({
      url: '/atelier/',
      path: 'tests',
      setupPath: './atelier/setup',
      uiSettings: {
        backgrounds: ['white', '', '#e0e0e0', '#a0a0a0', 'black']
      }
    })
  ],
  build: {
    sourcemap: mode === 'integration' ? 'inline' : false
  },
  ssr: {
    noExternal: ['simple-peer-light']
  },
  optimizeDeps: {
    exclude: ['@urql/svelte', '@atelier-wb/ui']
  },
  server: {
    port: 3000
  },
  preview: {
    // https://github.com/vitejs/vite/issues/4403#issuecomment-1007023263
    proxy: { 'http://localhost:3000': 'http://localhost:3000' },
    port: 3000,
    strictPort: true
  },
  test: {
    include: ['**/*.test.js'],
    deps: {
      inline: ['msw', 'svelte-hyperscript', 'whatwg-fetch']
    },
    globals: true, // needed for Atelier
    environment: 'jsdom',
    setupFiles: ['tests/setup']
  }
}))
