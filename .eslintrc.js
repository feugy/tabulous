module.exports = {
  extends: ['eslint:recommended'],
  env: {
    browser: true,
    es2020: true,
    node: true,
    jest: true
  },
  plugins: ['svelte3'],
  overrides: [
    {
      files: ['*.svelte'],
      processor: 'svelte3/svelte3'
    }
  ],
  parserOptions: {
    sourceType: 'module'
  },
  settings: {
    // unfortunately, eslint-plugin-svelte can not work with preprocessors, like postcss
    'svelte3/ignore-styles': () => true
  }
}
