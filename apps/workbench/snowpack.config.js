/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  workspaceRoot: '../..',
  mount: {
    public: { url: '/', static: true },
    src: { url: '/dist' }
  },
  plugins: ['@snowpack/plugin-svelte', 'snowpack-plugin-yaml'],
  devOptions: {
    port: 9090
  }
}
