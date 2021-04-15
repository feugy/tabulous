const isDev = process.env.NODE_ENV !== 'production'

const devPlugins = isDev ? ['@tabulous/workbench/plugins/snowpack'] : []

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  workspaceRoot: '../..',
  mount: {
    public: { url: '/', static: true },
    src: { url: '/dist' }
  },
  plugins: ['@snowpack/plugin-svelte', 'snowpack-plugin-yaml', ...devPlugins],
  optimize: {
    bundle: true,
    minify: true,
    treeshake: true,
    target: 'es2018'
  }
}
