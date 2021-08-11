export default {
  rootDir: './',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.graphql$': 'jest-transform-graphql'
  },
  moduleNameMapper: {
    '@src/(.+)$': '<rootDir>/src/$1'
  },
  // moduleFileExtensions: ['js', 'graphql'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  coverageProvider: 'v8',
  coverageDirectory: './coverage',
  collectCoverageFrom: ['<rootDir>/src/**/*.js']
}
