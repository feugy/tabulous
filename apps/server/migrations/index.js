import { readdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import Redis from 'ioredis'
import { loadConfiguration } from '../src/services/configuration.js'
import repositories from '../src/repositories/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationfileRexExp = /^\d+-.+\.js$/
const versionKey = 'migration:versions'
const options = {
  version: {
    type: 'string',
    short: 'v'
  }
}

async function main() {
  const {
    values: { version }
  } = parseArgs({ options })
  let desired = parseInt(version)
  if (version && (isNaN(desired) || desired < 0)) {
    throw new Error(`desired version '${version}' is not a positive number`)
  }
  const conf = loadConfiguration()
  await initRepositories(conf)
  const redis = await initRedisClient(conf.data)

  const applied = await readAppliedVersions(redis)
  const available = await readAvailableVersions(__dirname)
  if (!version) {
    desired = available.length
  }
  console.log(
    `[migration] last applied version: ${applied.length}, desired: ${desired}`
  )
  const incremented = []
  for (
    let next = applied.length + 1;
    next <= Math.min(desired, available.length);
    next++
  ) {
    await applyMigration(available[next - 1])
    incremented.push(next - 1)
  }
  console.log('[migration] all available migrations applied')
  if (incremented.length) {
    await updateAppliedVersions(redis, incremented)
  }
  process.exit(0)
}

config()
await main()

async function initRepositories(conf) {
  await repositories.players.connect(conf.data)
  await repositories.games.connect(conf.data)
}

async function initRedisClient(conf) {
  return new Redis(conf.data)
}

async function readAppliedVersions(redis) {
  const pairs = await redis.zrange(versionKey, 0, -1, 'WITHSCORES')
  return pairs.reduce((versions, value, rank) => {
    if (rank % 0) {
      versions._tmp = value
    } else {
      versions[value] = versions._tmp
      versions._tmp = undefined
    }
    return versions
  }, [])
}

async function updateAppliedVersions(redis, incremented) {
  await redis.zadd(
    versionKey,
    ...incremented.flatMap(version => [version, 'ok'])
  )
}

async function readAvailableVersions(folder) {
  const versions = []
  for (const dirent of await readdir(folder, { withFileTypes: true })) {
    if (dirent.isFile() && migrationfileRexExp.test(dirent.name)) {
      versions.push(dirent.name)
    }
  }
  const collator = new Intl.Collator([], { numeric: true })
  return versions.sort(collator.compare.bind(collator))
}

async function applyMigration(file) {
  console.log(`[migration] loading migration file: ${file}`)
  const { apply } = await import(`./${file}`)
  await apply(repositories)
  console.log(`[migration] ${file} applied`)
}
