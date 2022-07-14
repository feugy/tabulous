import atelier from '@atelier-wb/vite-plugin-atelier'
import graphql from '@rollup/plugin-graphql'
import yaml from '@rollup/plugin-yaml'
import { sveltekit } from '@sveltejs/kit/vite'
import windi from 'vite-plugin-windicss'
import { svelteSVG } from 'rollup-plugin-svelte-svg'

// This file is used by
// - vite
/** @type {import('vite').UserConfig} */
const config = {
  envPrefix: 'WEB_',
  plugins: [
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
  ssr: {
    noExternal: ['simple-peer-light']
  },
  optimizeDeps: {
    exclude: ['@urql/svelte', '@atelier-wb/ui']
  },
  server: {
    https: true,
    host: '0.0.0.0',
    proxy: {
      '/ws': {
        target: 'http://localhost:3001',
        ws: true
      },
      '/graphql': {
        target: 'http://localhost:3001',
        ws: true
      },
      '^/auth/?': {
        target: 'http://localhost:3001'
      },
      '^/graphql/?': {
        target: 'http://localhost:3001'
      },
      '/games': {
        target: 'http://localhost:3001'
      }
    }
  },
  preview: {
    port: 3000,
    strictPort: true
  }
}

export default config
