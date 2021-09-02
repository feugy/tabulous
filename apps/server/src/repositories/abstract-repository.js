import { randomUUID } from 'crypto'

/**
 * @typedef {object} Page
 * @property {number} total - total number of models.
 * @property {number} size - 0-based rank of the first model returned.
 * @property {number} from - maximum number of models per page.
 * @property {string} sort - sorting criteria used: direction (+ or -) then property (name, rank...).
 * @property {object[]} results - returned models.
 */

export class AbstractRepository {
  /**
   * Builds a repository to manage a given set of models.
   * Base class for all repository classes, providing CRUD operations.
   * @param {object} args - arguments, including:
   * @param {string} args.name - model name.
   * @returns {AbstractRepository} a model repository.
   */
  constructor({ name }) {
    if (!name) {
      throw new Error(`every repository needs a name`)
    }
    this.name = name
    this.modelsById = new Map()
  }

  /**
   * Connects the repository to the underlying storage system.
   * @async
   * @param {object} args - connection arguments.
   */
  async connect() {
    this.modelsById.clear()
  }

  /**
   * Tears the repository down to release its connection
   */
  async release() {
    this.modelsById.clear()
  }

  /**
   * Lists models with pagination and sort.
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
    return Array.isArray(ids) ? results : results[0]
  }
}
