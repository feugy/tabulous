// @ts-check
/**
 * @typedef {typeof import('@tabulous/server/src/repositories').default} Repositories
 */
/**
 * @template {{id: string}} M
 * @typedef {import('@tabulous/server/src/repositories/abstract-repository').AbstractRepository<M> } AbstractRepository
 */

import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Applies the migration.
 * @param {Repositories} repositories - connected repositories.
 * @returns {Promise<void>}
 */
export async function apply(repositories) {
  await migrateJSONData(repositories.players)
  await migrateJSONData(repositories.games)
}

/**
 * @template {{id: string}} M
 * @template {AbstractRepository<M>} R
 * @param {R} repository
 * @returns {Promise<void>}
 */
async function migrateJSONData(repository) {
  const { name } = repository
  const file = join(fileURLToPath(import.meta.url), `../../data/${name}.json`)
  if (await access(file).catch(() => true)) {
    return
  }
  console.log(`reading old data file ${file}`)
  /** @type {Map<string, M>} */
  const models = new Map(JSON.parse(await readFile(file, 'utf-8')))
  console.log(`${models.size} ${name} to save`)
  await repository.save([...models.values()])
  console.log(`${name} migrated!`)
}
