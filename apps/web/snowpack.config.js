/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  workspaceRoot: '../..',
  mount: {
    public: { url: '/', static: true },
    src: { url: '/dist' },
    // TODO would need to discard in prod
    workbench: { url: '/workbench' }
  },
  plugins: ['@snowpack/plugin-svelte', 'snowpack-plugin-yaml'],
  optimize: {
    bundle: true,
    minify: true,
    treeshake: true,
    target: 'es2018'
  }
}
