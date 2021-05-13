// This file is used by
// - svelte.config.js
// - "VSCode Tailwind CSS IntelliSense" plugin
module.exports = {
  plugins: [
    // need to explicitly pass configuration as tailwind doesn't like monorepo structure
    require('tailwindcss')(require('./tailwind.config.js')),
    require('postcss-nested'),
    require('autoprefixer')
  ]
}
