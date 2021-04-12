// This file is used by
// - @snowpack/plugin-svelte (through svelte.config.mjs)
// - "Svelte for VS Code" plugin (through svelte.config.mjs)
// - "VSCode Tailwind CSS IntelliSense" plugin
module.exports = {
  plugins: [
    require('postcss-import'),
    require('tailwindcss'),
    require('postcss-nested'),
    require('autoprefixer')
  ]
}
