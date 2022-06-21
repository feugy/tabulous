import atelier from '@atelier-wb/vite-plugin-atelier'
import graphql from '@rollup/plugin-graphql'
import yaml from '@rollup/plugin-yaml'
import adapter from '@sveltejs/adapter-static'
import windi from 'vite-plugin-windicss'

// This file is used by
// - jest-transform-svelte
// - "Svelte for VS Code" plugin
// - svelte kit
/** @type {import('@sveltejs/kit').Config} */
const config = {
  onwarn(warning, defaultHandler) {
    if (warning.code === 'a11y-autofocus') return
    defaultHandler(warning)
  },
  kit: {
    adapter: adapter({ pages: 'dist', assets: 'dist', fallback: 'index.html' }),
    files: {
      assets: 'public'
    },
    prerender: {
      default: false
    },
    vite: {
      plugins: [
        windi(),
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
          },
          '/games': {
            target: 'http://localhost:3001'
          }
        }
      }
    }
  }
}

export default config
