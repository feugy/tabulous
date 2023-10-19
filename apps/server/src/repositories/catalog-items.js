// @ts-check
import { readdir, readFile, stat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import { build } from 'esbuild'

import { makeLogger } from '../utils/index.js'

class CatalogItemRepository {
  /**
   * Builds a repository to manage the games catalog item.
   * It reads game descriptors from the file system, and can not be created, saved nor deleted.
   */
  constructor() {
    this.name = 'catalog'
    /** @type {import('@tabulous/types').GameDescriptor[]} */
    this.models = []
    /** @type {Map<string, import('@tabulous/types').GameDescriptor>} */
    this.modelsByName = new Map()
    /** @private @type {string} */
    this.root = ''
    this.logger = makeLogger(`${this.name}-repository`, {
      ctx: { name: this.name }
    })
  }

  /**
   * Connects the repository to the underlying storage system.
   * It reads all available descriptors.
   * @param {object} args - connection arguments:
   * @param {string} args.path - folder path containing game descriptors.
   * @throws {Error} when provided path is not a readable folder.
   */
  async connect({ path }) {
    this.root = pathToFileURL(path).pathname
    const ctx = { root: this.root }
    this.logger.trace({ ctx }, 'initializing repository')
    let entries
    this.models = []
    this.modelsByName.clear()
    try {
      entries = await readdir(path, { withFileTypes: true })
    } catch (err) {
      throw new Error(
        `Failed to connect Catalog Items repository: ${
          /** @type {Error} */ (err).message
        }`
      )
    }
    for (const entry of entries) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        await this.reload(entry.name)
      }
    }
    this.logger.info(
      { ctx, res: [...this.modelsByName.keys()] },
      'initialized repository'
    )
  }

  /**
   * Loads a catalog item from the file system, bundling its rules with esbuild.
   * @param {string} name - name of the catalog item, relative to the root folder.
   */
  async reload(name) {
    const descriptor = `${this.root}/${name}/index.js`
    const rules = `${this.root}/${name}/engine.min.js`
    const ctx = { root: this.root }

    try {
      /** @type {import('@tabulous/types').GameDescriptor} */
      const item = {
        name,
        ...(await import(`${descriptor}?cache_buster=${Date.now()}`))
      }

      this.logger.debug(
        { ctx, gameName: name },
        `bundling rule engine for ${name}`
      )
      const buildResult = await build({
        entryPoints: [descriptor],
        bundle: true,
        minify: true,
        globalName: 'engine',
        sourcemap: 'inline',
        outfile: rules
      })
      if (buildResult.errors.length) {
        throw new Error(
          `can not bundle rule engine: ${buildResult.errors
            .map(({ text }) => text)
            .join('\n')}`
        )
      }

      this.modelsByName.set(name, item)
      this.models = [...this.modelsByName.values()]
      this.logger.trace({ ctx, name }, `game ${name} loaded`)
    } catch (err) {
      // ignore folders with no index.js or invalid symbolic links
      if (
        err instanceof Error &&
        !err.message.includes(`Cannot find module '${descriptor}'`)
      ) {
        throw new Error(`Failed to load game ${name}: ${err.message}`)
      }
    }
  }

  /**
   * Tears the repository down to release its connection.
   */
  async release() {
    this.models = []
    this.modelsByName.clear()
    this.logger.debug('reseted repository')
  }

  /**
   * Lists all catalog items.
   * It complies with Page convention, but always returns all the available items.
   * @returns {Promise<import('./abstract-repository').Page<import('@tabulous/types').GameDescriptor>>} a given page of catalog items.
   */
  async list() {
    this.logger.trace('listing models')
    return {
      total: this.models.length,
      from: 0,
      size: Number.POSITIVE_INFINITY,
      results: this.models
    }
  }

  /**
   * @overload
   * Get a single model by their id.
   * @param {string} id - desired id.
   * @returns {Promise<?import('@tabulous/types').GameDescriptor>} matching model, or null.
   */
  /**
   * @overload
   * Get a several models by their ids.
   * @param {string[]} id - desired ids.
   * @returns {Promise<(?import('@tabulous/types').GameDescriptor)[]>} matching models, or nulls.
   */
  async getById(/** @type {string|string[]} */ id) {
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

  /**
   * Reads the content of the rule engine file of a given catalog item.
   * @param {string|undefined} name - name of the catalog item.
   * @returns content of the engine script, if any.
   */
  async getEngineScript(name) {
    if (name) {
      const rules = `${this.root}/${name}/engine.min.js`
      const engineScript = await stat(rules)
        .then(() => readFile(rules, 'utf-8'))
        .catch(() => undefined)
      return engineScript
    }
  }
}

/**
 * Catalog item repository singleton.
 */
export const catalogItems = new CatalogItemRepository()
