const { windi } = require('svelte-windicss-preprocess')

// This file is used by
// - @svelte/vite-plugin-svelte
// - jest-transform-svelte
// - "Svelte for VS Code" plugin
module.exports = {
  preprocess: windi()
}
