const conf = {
  rootDir: './',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': [
      '<rootDir>/tests/jest-transformer.cjs',
      {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
      }
    ],
    '^.+\\.graphql$': 'jest-transform-graphql',
    '^.+\\.svelte$': 'jest-transform-svelte',
    '^.+\\.ya?ml$': 'jest-yaml-transform'
  },
  transformIgnorePatterns: [
    'node_modules\\/(?!@babylonjs|simple-peer-light|svelte-portal|@atelier-wb|@sveltejs)'
  ],
  moduleNameMapper: {
    '^.+\\.png$': 'identity-obj-proxy',
    '^.+\\.(post)?css$': 'identity-obj-proxy',
    '^\\$lib(.*)$': '<rootDir>/src/lib$1',
    '^\\$app(.*)$': '<rootDir>/../../node_modules/@sveltejs/kit/assets/app$1'
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

export default conf
