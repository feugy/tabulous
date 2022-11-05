module.exports = {
  extends: ['eslint:recommended'],
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  plugins: ['svelte3', 'simple-import-sort'],
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
  },
  rules: {
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error'
  }
}
