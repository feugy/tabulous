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
  coverageProvider: 'v8',
  coverageDirectory: './coverage',
  collectCoverageFrom: ['<rootDir>/src/**/*.js', '!<rootDir>/src/index.js']
}
