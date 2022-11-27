// @ts-check
import { readdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { config } from 'dotenv'
import Redis from 'ioredis'

import repositories from '../src/repositories/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationfileRexExp = /^\d+-.+\.js$/
const versionKey = 'migration:versions'

/** @type {import('node:util').ParseArgsConfig} */
const options = {
  options: {
    version: {
      type: 'string',
      short: 'v'
    }
  }
}

async function main() {
  const {
    values: { version }
  } = parseArgs(options)
  let desired = parseInt(version + '')
  if (version && (isNaN(desired) || desired < 0)) {
    throw new Error(`desired version '${version}' is not a positive number`)
  }
  const redis = await initRepositories(
    process.env.REDIS_URL ?? 'redis://localhost:6379'
  )

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
    const rank = next - 1
    await applyMigration(available[rank])
    incremented.push(available[rank])
  }
  console.log('[migration] all available migrations applied')
  if (incremented.length) {
    await updateAppliedVersions(redis, incremented)
  }
  process.exit(0)
}

config()
await main()

async function initRepositories(url) {
  await repositories.players.connect({ url })
  await repositories.games.connect({ url })
  return new Redis(url, { enableReadyCheck: false })
}

async function readAppliedVersions(redis) {
  return redis.smembers(versionKey)
}

async function updateAppliedVersions(redis, incremented) {
  await redis.sadd(versionKey, incremented)
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
