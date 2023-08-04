module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:svelte/recommended', 'prettier'],
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  plugins: ['simple-import-sort', 'vitest', '@typescript-eslint'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
    extraFileExtensions: ['.svelte']
  },
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser'
      }
    }
  ],
  rules: {
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'vitest/no-focused-tests': 'error'
  }
}
