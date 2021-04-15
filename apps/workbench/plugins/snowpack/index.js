const { resolve } = require('path')
const { readdir, readFile, writeFile } = require('fs/promises')
const fastify = require('fastify')
const fastifyStatic = require('fastify-static')

const pluginName = 'snowpack-plugin-workbench'

const defaultOptions = {
  path: './workbench',
  mountUrl: '/workbench',
  toolRegexp: '.tools.svelte$',
  port: 9090,
  htmlTemplate: resolve(__dirname, 'index.html.tpl')
}

async function findTools(path, detectionRegex) {
  const entries = []
  for (const entry of await readdir(path, {
    withFileTypes: true
  })) {
    const { name } = entry
    if (entry.isFile() && detectionRegex.test(name)) {
      entries.push(name)
    } else if (entry.isDirectory()) {
      entries.push(...(await findTools(name, detectionRegex)))
    }
  }
  return entries
}

// https://github.com/snowpackjs/snowpack/blob/578a6b4e28a3afc1b83671ef76a2b0343daedb81/snowpack/src/types.ts#L161-L196
module.exports = function (snowpackConfig, pluginOptions = {}) {
  const options = { ...pluginOptions, ...defaultOptions }
  if (!options.path) {
    throw new Error(`${pluginName} requires 'path' option`)
  }

  const server = fastify()
  server.register(fastifyStatic, {
    root: resolve(__dirname, '..', '..', 'build')
  })

  let publicFolder

  return {
    name: pluginName,

    config(config) {
      for (const [path, mount] of Object.entries(config.mount)) {
        if (mount.url === '/') {
          publicFolder = path
        }
      }
      const path = resolve(options.path)
      if (path in config.mount) {
        return config
      }
      config.mount[path] = {
        url: options.mountUrl,
        static: false,
        resolve: true
      }
    },

    async run() {
      const htmlTemplate = await readFile(options.htmlTemplate, 'utf8')
      const html = htmlTemplate.replace('%MOUNT_POINT%', options.mountUrl)
      // TODO use some "virtual" file
      await writeFile(resolve(publicFolder, 'workbench.html'), html)

      // TODO automatically generates index
      console.log(await findTools(options.path, new RegExp(options.toolRegex)))

      await server.listen(options.port)
    },

    async cleanup() {
      return server.close()
    }
  }
}
