export default {
  rootDir: './',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.graphql$': 'jest-transform-graphql'
  },
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  // https://github.com/facebook/jest/issues/11438#issuecomment-916711164
  testTimeout: 30000,
  maxWorkers: 16,
  coverageDirectory: './coverage',
  collectCoverageFrom: ['<rootDir>/src/**/*.js', '!<rootDir>/src/index.js']
}
