import { readdir } from 'fs/promises'
import { pathToFileURL } from 'url'

import { AbstractRepository } from './abstract-repository.js'

class CatalogItemRepository extends AbstractRepository {
  /**
   * Builds a repository to manage the games catalog item.
   * It reads game descriptors from the file system, and can not be created, saved nor deleted.
   * @param {object} args - arguments, including:
   * @returns {CatalogItemRepository} a model repository.
   */
  constructor() {
    super({ name: 'catalog' })
    this.models = []
  }

  /**
   * Connects the repository to the underlying storage system.
   * It reads all available descriptors.
   * @async
   * @param {object} args - connection arguments:
   * @param {string} args.path - folder path containing game descriptors.
   * @throws {Error} when provided path is not a readable folder.
   */
  async connect({ path }) {
    let entries
    this.models = []
    this.modelsByName = new Map()
    try {
      entries = await readdir(path, { withFileTypes: true })
    } catch (err) {
      throw new Error(
        `Failed to connect Catalog Items repository: ${err.message}`
      )
    }
    const root = pathToFileURL(path).pathname
    for (const entry of entries) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const descriptor = `${root}/${entry.name}/index.js`
        try {
          const { name } = entry
          const item = {
            name,
            ...(await import(descriptor))
          }
          this.models.push(item)
          this.modelsByName.set(name, item)
        } catch (err) {
          /* c8 ignore start */
          // ignore folders with no index.js or invalid symbolic links
          // Since recently (https://github.com/vitest-dev/vitest/commit/58ee8e9b6300fd6899072e34feb766805be1593c),
          // it can not be tested under vitest because an uncatchable rejection will be thrown
          if (!err.message.includes(`Cannot find module '${descriptor}'`)) {
            throw new Error(`Failed to load game ${entry.name}: ${err.message}`)
          }
          /* c8 ignore stop */
        }
      }
    }
  }

  /**
   * Tears the repository down to release its connection.
   */
  async release() {
    super.release()
    this.models = []
  }

  /**
   * Lists all catalog items.
   * It complies with Page convention, but always returns all the available items.
   * @async
   * @param {object} args - list arguments:
   * @returns {import('./abstract-repository').Page} a given page of catalog items.
   */
  async list() {
    return {
      total: this.models.length,
      from: 0,
      size: Number.POSITIVE_INFINITY,
      results: this.models
    }
  }

  /**
   * Get a single or several model by their id.
   * @async
   * @param {string|string[]} id - desired id(s).
   * @returns {object|null|(object|null)[]} matching model(s), or null(s).
   */
  async getById(id) {
    const ids = Array.isArray(id) ? id : [id]
    const results = []
    for (const id of ids) {
      results.push(this.modelsByName.get(id) ?? null)
    }
    return Array.isArray(id) ? results : results[0]
  }

  /**
   * @deprecated
   * @async
   * @throws {Error} - since catalog items can not be saved.
   */
  async save() {
    throw new Error(`Catalog items can not be saved`)
  }

  /**
   * @deprecated
   * @async
   * @throws {Error} - since catalog items can not be deleted.
   */
  async deleteById() {
    throw new Error(`Catalog items can not be deleted`)
  }
}

/**
 * Catalog item repository singleton.
 * @type {CatalogItemRepository}
 */
export const catalogItems = new CatalogItemRepository()
