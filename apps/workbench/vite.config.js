import { defineConfig } from 'vite'
import svelte from '@sveltejs/vite-plugin-svelte'
import yaml from '@rollup/plugin-yaml'

export default defineConfig({
  base: '', // allows embedded deployments
  plugins: [svelte(), yaml()],
  server: {
    port: 3001,
    open: true
  }
})
