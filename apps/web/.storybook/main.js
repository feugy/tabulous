module.exports = {
  stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(js|svelte)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    // not supported yet with webpack5 
    // '@storybook/addon-svelte-csf',
    '@storybook/addon-postcss'
  ],
  core: {
    builder: "webpack5"
  },
  webpackFinal: async(config) => {
    // @babylonjs/core files can't be loaded with webpack5 because they don't have .js extension and are declared as modules
    for (const rule of config.module.rules) {
      rule.resolve = { fullySpecified: false }
    }
    return config
  }
}
