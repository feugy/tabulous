module.exports = {
  rootDir: './',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': [
      '<rootDir>/tests/jest-transformer.js',
      {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
      }
    ],
    '^.+\\.graphql$': 'jest-transform-graphql',
    '^.+\\.svelte$': 'jest-transform-svelte',
    '^.+\\.ya?ml$': 'jest-yaml-transform'
  },
  transformIgnorePatterns: [
    'node_modules\\/(?!@babylonjs|simple-peer-light|svelte-spa-router|svelte-portal|@atelier-wb)'
  ],
  moduleNameMapper: {
    '^.+\\.png$': 'identity-obj-proxy',
    '^.+\\.(post)?css$': 'identity-obj-proxy'
  },
  moduleFileExtensions: ['js', 'svelte', 'graphql'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest-setup.js'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  coverageDirectory: './coverage',
  collectCoverageFrom: ['<rootDir>/src/**/*.js', '<rootDir>/src/**/*.svelte']
}
