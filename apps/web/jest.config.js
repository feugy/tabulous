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
    '^.+\\.svelte$': 'jest-transform-svelte',
    '^.+\\.ya?ml$': 'jest-yaml-transform'
  },
  moduleNameMapper: {
    '@src/(.+)$': '<rootDir>/src/$1'
  },
  transformIgnorePatterns: ['node_modules\\/(?!@babylonjs)'],
  moduleFileExtensions: ['js', 'svelte'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest-setup.js'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  coverageDirectory: './coverage',
  collectCoverageFrom: ['<rootDir>/src/**/*.js', '<rootDir>/src/**/*.svelte']
}
