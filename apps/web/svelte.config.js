import vercel from '@sveltejs/adapter-vercel'
import { windi } from 'svelte-windicss-preprocess'

// This file is used by
// - "Svelte for VS Code" plugin
// - svelte kit
/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: vercel({ runtime: 'edge' }),
    files: { assets: 'public' },
    output: { preloadStrategy: 'preload-mjs' }
  },
  preprocess: [windi()]
}

export default config
