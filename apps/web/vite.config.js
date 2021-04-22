import { join } from 'path'
import { defineConfig } from 'vite'
import svelte from '@sveltejs/vite-plugin-svelte'
import yaml from '@rollup/plugin-yaml'
import atelier from '@atelier/vite-plugin-svelte'

export default defineConfig({
  plugins: [
    svelte(),
    yaml(),
    atelier({
      path: 'tests',
      // it has to be an absolute path
      setupPath: join(__dirname, 'tests', 'atelier-setup.js')
    })
  ],
  server: { open: true }
})
