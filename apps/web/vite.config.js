import { join } from 'path'
import { defineConfig } from 'vite'
import svelte from '@sveltejs/vite-plugin-svelte'
import yaml from '@rollup/plugin-yaml'
import workbench from '../workbench/plugins/vite'

export default defineConfig({
  plugins: [
    svelte(),
    yaml(),
    workbench({
      // it has to be an absolute path
      setupPath: join(__dirname, 'workbench', 'setup.js')
    })
  ],
  server: { open: true }
})
