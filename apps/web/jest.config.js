const conf = {
  rootDir: './',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.svg$': '<rootDir>/tests/jest/svg.js',
    '^.+\\.js$': [
      '<rootDir>/tests/jest/javascript.js',
      {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
      }
    ],
    '^.+\\.graphql$': '<rootDir>/tests/jest/graphql.cjs',
    '^.+\\.svelte$': 'jest-transform-svelte',
    '^.+\\.ya?ml$': '<rootDir>/tests/jest/yaml.js'
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
  setupFilesAfterEnv: ['<rootDir>/tests/jest/setup.js'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  coverageDirectory: './coverage',
  collectCoverageFrom: ['<rootDir>/src/**/*.js', '<rootDir>/src/**/*.svelte']
}

export default conf
