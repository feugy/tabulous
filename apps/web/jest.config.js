module.exports = {
  rootDir: 'src/',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': [
      'babel-jest',
      {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
      }
    ],
    '^.+\\.svelte$': 'svelte-jester'
  },
  transformIgnorePatterns: ['node_modules\\/(?!@babylonjs|@storybook)'],
  moduleFileExtensions: ['js', 'svelte', 'json', 'yml'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  coverageDirectory: '../coverage',
  collectCoverageFrom: [
    '**/*.js',
    '**/*.svelte',
    '!**/*.test.js',
    '!**/*.stories.*'
  ]
}
