/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  mount: {
    public: { url: '/', static: true },
    src: { url: '/dist' }
  },
  plugins: ['@snowpack/plugin-svelte', 'snowpack-plugin-yaml'],
  routes: [],
  optimize: {
    bundle: true,
    minify: true,
    treeshake: true,
    target: 'es2018'
  },
  packageOptions: {},
  devOptions: {},
  buildOptions: {}
}
