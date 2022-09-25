import vercel from '@sveltejs/adapter-vercel'

// This file is used by
// - "Svelte for VS Code" plugin
// - svelte kit
/** @type {import('@sveltejs/kit').Config} */
const config = {
  onwarn(warning, defaultHandler) {
    if (warning.code === 'a11y-autofocus') return
    defaultHandler(warning)
  },
  kit: {
    adapter: vercel({ edge: true }),
    files: {
      assets: 'public'
    }
  }
}

export default config
