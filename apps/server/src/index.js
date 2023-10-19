// @ts-check
import { sep } from 'node:path'

import { config } from 'dotenv'

import { startServer } from './server.js'
import services from './services/index.js'

config()
const conf = services.loadConfiguration()

if (!conf.isProduction) {
  const { default: nodemon } = await import('nodemon')
  nodemon({
    script: 'src/dev',
    watch: ['../games'],
    ignore: ['catalog/en', 'images/en', 'textures/en', 'engine.min.js']
  }).on('restart', async function (files) {
    for (const kind of extractGameIds(conf.games.path, files)) {
      await services.reloadGames(kind)
    }
  })
}

startServer(conf)

function extractGameIds(
  /** @type {string} */ basePath,
  /** @type {string[]|undefined} */ files
) {
  return [
    ...new Set(
      files?.map(file => file.replace(conf.games.path, '').split(sep, 2)[1])
    )
  ]
}
