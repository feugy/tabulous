import adapter from '@sveltejs/adapter-static'

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
    }
  }
}

export default config
