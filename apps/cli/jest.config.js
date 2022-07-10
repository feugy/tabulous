export default {
  rootDir: './',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    /* https://github.com/chalk/chalk/issues/532#issuecomment-1062018375 */
    '#(.*)': '<rootDir>../../node_modules/$1'
  },
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  coverageDirectory: './coverage',
  collectCoverageFrom: ['<rootDir>/src/**/*.js', '<rootDir>/src/index.mjs']
}
