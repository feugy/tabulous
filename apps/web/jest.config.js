module.exports = {
  rootDir: './',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': [
      'babel-jest',
      {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
      }
    ],
    '^.+\\.graphql$': 'jest-transform-graphql',
    '^.+\\.svelte$': 'jest-transform-svelte',
    '^.+\\.ya?ml$': 'jest-yaml-transform'
  },
  transformIgnorePatterns: [
    'node_modules\\/(?!@babylonjs|simple-peer-light|svelte-spa-router|svelte-portal)'
  ],
  moduleFileExtensions: ['js', 'svelte', 'graphql'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest-setup.js'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  coverageDirectory: './coverage',
  collectCoverageFrom: ['<rootDir>/src/**/*.js', '<rootDir>/src/**/*.svelte']
}
