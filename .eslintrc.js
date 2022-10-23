module.exports = {
  extends: ['eslint:recommended'],
  env: {
    browser: true,
    es2022: true,
    node: true,
    jest: true
  },
  plugins: ['svelte3'],
  globals: {
    vi: true
  },
  overrides: [
    {
      files: ['*.svelte'],
      processor: 'svelte3/svelte3'
    },
    {
      files: ['*.js'],
      extends: ['prettier']
    }
  ],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022
  }
}
