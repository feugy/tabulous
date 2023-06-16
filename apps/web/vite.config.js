// @ts-check
import { resolve } from 'node:path'

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
        backgrounds: [
          `local url('/background-hexagon.svg') rgb(249, 250, 251) repeat`,
          '#e3ebf1',
          '#c6d8e3',
          '#6096b4',
          'white',
          'black'
        ]
      }
    })
  ],
  build: {
    sourcemap: mode === 'integration' ? 'inline' : true
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
  resolve: {
    alias: {
      '@src': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests')
    }
  },
  test: {
    // https://github.com/vitest-dev/vitest/issues/2834
    alias: [{ find: /^svelte$/, replacement: 'svelte/internal' }],
    include: ['**/*.test.js'],
    deps: {
      inline: ['msw', 'svelte-hyperscript', 'whatwg-fetch']
    },
    globals: true, // needed for Atelier
    environment: 'jsdom',
    setupFiles: ['tests/setup']
  }
}))
