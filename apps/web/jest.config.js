const conf = {
  rootDir: './',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': [
      '<rootDir>/tests/js-transformer.js',
      {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
      }
    ],
    '^.+\\.graphql$': '<rootDir>/tests/graphql-transformer.cjs',
    '^.+\\.svelte$': 'jest-transform-svelte',
    '^.+\\.ya?ml$': '<rootDir>/tests/yaml-transformer.js'
  },
  transformIgnorePatterns: [
    'node_modules\\/(?!@babylonjs|simple-peer-light|@atelier-wb|htm|svelte-portal)'
  ],
  moduleNameMapper: {
    '^.+\\.png$': 'identity-obj-proxy',
    '^.+\\.(post)?css$': 'identity-obj-proxy',
    '^\\$lib(.*)$': '<rootDir>/src/lib$1',
    '^\\$app(.*)$': '<rootDir>/.svelte-kit/runtime/app$1'
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
