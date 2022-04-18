import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

/**
 * @typedef {object} Page
 * @property {number} total - total number of models.
 * @property {number} size - 0-based rank of the first model returned.
 * @property {number} from - maximum number of models per page.
 * @property {string} sort - sorting criteria used: direction (+ or -) then property (name, rank...).
 * @property {object[]} results - returned models.
 */

async function persist(repository) {
  return repository.file
    ? writeFile(
        repository.file,
        JSON.stringify([...repository.modelsById.entries()])
      )
    : null
}

async function scheduleSave(repository) {
  clearTimeout(repository.saveTimer)
  repository.saveTimer = setTimeout(
    () => persist(repository).catch(err => console.error(err)),
    repository.saveDelay
  )
}

export class AbstractRepository {
  /**
   * Builds a repository to manage a given set of models.
   * Base class for all repository classes, providing CRUD operations.
   * @param {object} args - arguments, including:
   * @param {string} args.name - model name.
   * @param {number} [args.saveDelay=10000] - delay (in ms) before persisting data after it got updated.
   * @returns {AbstractRepository} a model repository.
   */
  constructor({ name, saveDelay = 10e3 }) {
    if (!name) {
      throw new Error(`every repository needs a name`)
    }
    this.name = name
    this.saveDelay = saveDelay
    this.modelsById = new Map()
  }

  /**
   * Connects the repository to the underlying storage system.
   * Will store models into a JSON file named after the repository.
   * @async
   * @param {object} args - connection arguments:
   * @param {string} args.path - folder path in which data will be stored.
   */
  async connect({ path }) {
    if (path) {
      this.file = join(path, `${this.name}.json`)
      await mkdir(dirname(this.file), { recursive: true })
      try {
        this.modelsById = new Map(
          JSON.parse(await readFile(this.file, 'utf-8'))
        )
      } catch (err) {
        if (err?.code === 'ENOENT') {
          this.modelsById = new Map()
          persist(this)
        } else {
          throw new Error(
            `Failed to connect repository ${this.name}: ${err.message}`
          )
        }
      }
    } else {
      this.file = null
      this.modelsById = new Map()
    }
  }

  /**
   * Tears the repository down to release its connection.
   * Saves data onto storage.
   */
  async release() {
    clearTimeout(this.saveTimer)
    await persist(this)
    this.modelsById.clear()
  }

  /**
   * Lists models with pagination.
   * @async
   * @param {object} args - list arguments, including:
   * @param {number} [args.from = 0] - 0-based index of the first result
   * @param {number} [args.size = 10] - maximum number of models returned after first results.
   * @returns {Page} a given page of models.
   */
  async list({ from = 0, size = 10 } = {}) {
    let i = 0
    const results = []
    for (const [, model] of this.modelsById) {
      if (i >= from + size) {
        break
      }
      if (i >= from) {
        results.push(model)
      }
      i++
    }
    return { total: this.modelsById.size, from, size, results }
  }

  /**
   * Get a single or several model by their id.
   * @async
   * @param {string|string[]} id - desired id(s).
   * @returns {object|null|[object|null]} matching model(s), or null(s).
   */
  async getById(id) {
    const ids = Array.isArray(id) ? id : [id]
    const results = []
    for (const id of ids) {
      results.push(this.modelsById.get(id) ?? null)
    }
    return Array.isArray(id) ? results : results[0]
  }

  /**
   * Saves given model to storage.
   * It creates new model when needed, and updates existing ones (based on provided id).
   * Partial update is supported: incoming data is merged with previous (top level properties only).
   * @async
   * @param {object|object[]} data - single or array of saved (partial) models.
   * @returns {object|object[]} single or array of saved models.
   */
  async save(data) {
    const records = Array.isArray(data) ? data : [data]
    const results = []
    for (const record of records) {
      if (!record.id) {
        record.id = randomUUID()
      }
      const saved = { ...(this.modelsById.get(record.id) ?? {}), ...record }
      results.push(saved)
      this.modelsById.set(record.id, saved)
    }
    scheduleSave(this)
    return Array.isArray(data) ? results : results[0]
  }

  /**
   * Deletes models by their ids.
   * Unmatching ids will be simply ignored and null will be returned instead.
   * @async
   * @param {string|string[]} ids - ids of removed models.
   * @returns {object|null|[object|null]} single or array of removed models and nulls.
   */
  async deleteById(ids) {
    const recordIds = Array.isArray(ids) ? ids : [ids]
    const results = []
    for (const id of recordIds) {
      results.push(this.modelsById.get(id) ?? null)
      this.modelsById.delete(id)
    }
    scheduleSave(this)
    return Array.isArray(ids) ? results : results[0]
  }
}
