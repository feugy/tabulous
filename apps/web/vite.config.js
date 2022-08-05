// @ts-check
import atelier from '@atelier-wb/vite-plugin-atelier'
import graphql from '@rollup/plugin-graphql'
import yaml from '@rollup/plugin-yaml'
import { sveltekit } from '@sveltejs/kit/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'
import windi from 'vite-plugin-windicss'
import { svelteSVG } from 'rollup-plugin-svelte-svg'

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
      },
      publicDir: ['./tests']
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
    https: true,
    port: 3000
  },
  preview: {
    port: 3000,
    strictPort: true
  }
}))
