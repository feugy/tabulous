import { randomUUID } from 'crypto'
import Redis from 'ioredis'

/**
 * @typedef {import('ioredis').ChainableCommander} Transaction
 */

/**
 * @typedef {object} Page
 * @property {number} total - total number of models.
 * @property {number} size - 0-based rank of the first model returned.
 * @property {number} from - maximum number of models per page.
 * @property {string} sort - sorting criteria used: direction (+ or -) then property (name, rank...).
 * @property {object[]} results - returned models.
 */

/**
 * @typedef {object} DeleteTransactionContext
 * @property {Transaction} transaction - deletion transaction.
 * @property {(object | null)[]} models - array of deleted record object.
 * @property {string[]} keys - array of deleted Redis keys.
 */

/**
 * @typedef {object} SaveTransactionContext
 * @property {Transaction} transaction - save transaction.
 * @property {object[]} models - array of saved models.
 * @property {object[]} existings - array of pre-existing models.
 * @property {(number | string)[]} indexed - for newly inserted models, their score and id.
 */

/**
 * @typedef {object} SaveModelContext
 * @property {Transaction} transaction - save transaction.
 * @property {object} model - saved model.
 * @property {string} key - Redis key for this model.
 */

/**
 * @typedef {object} FieldDescriptor
 * @property {string} name - the field name.
 * @property {(value: string) => any} deserialize - function used to deserialize string values from Redis into JSON values.
 */

export class AbstractRepository {
  /**
   * @type {FieldDescriptor[]}
   * Describes fields that must be serialized/deserialized in Redis
   */
  static fields = []

  /**
   * Builds a repository to manage a given set of models.
   * Base class for all repository classes, providing CRUD operations on top of Redis.
   * Managed records must be JSON object with an `id` field.
   * The underlying structure is:
   * - ${name}:${id} holds the model, as a redis hash.
   * - index:${name} is a Redis sorted set where values are record ids, and scores an incremented int
   * - score:${name} is a Redis integer, holding the next available score
   * @param {object} args - arguments, including:
   * @param {string} args.name - model name.
   * @returns {AbstractRepository} a model repository.
   */
  constructor({ name }) {
    if (!name) {
      throw new Error(`every repository needs a name`)
    }
    this.name = name
    this.client = null
    this.nextScore = 0
    this.scoreKey = `score:${this.name}`
    this.indexKey = `index:${this.name}`
  }

  /**
   * Builds the key of a given model of this repository
   * @private
   * @param {string} id - the concerned model id.
   * @returns {string} the corresponding key.
   */
  _buildKey(id) {
    return `${this.name}:${id}`
  }

  /**
   * Connects the repository to the underlying storage system.
   * Will store models into a JSON file named after the repository.
   * @param {object} args - connection arguments:
   * @param {string} args.url - url to the Redis Database, including potential authentication.
   * @param {boolean} [args.isProduction = true] - when false, displays friendly stacktraces, which penalize performances.
   * @returns {Promise<void>}
   */
  async connect({ url, isProduction = true }) {
    if (!this.client) {
      await new Promise((resolve, reject) => {
        this.client = new Redis(url, {
          enableAutoPipelining: true,
          enableReadyCheck: false,
          showFriendlyErrorStack: !isProduction
        })
        this.client.once('connect', () => {
          this.client.removeAllListeners('error')
          resolve()
        })
        this.client.once('error', error => {
          this.client.removeAllListeners('connect')
          reject(
            new Error(
              `Failed to connect repository ${this.name}: ${error.message}`
            )
          )
        })
      })
      this.nextScore = parseInt((await this.client.get(this.scoreKey)) || '0')
    }
  }

  /**
   * Tears the repository down to release its connection.
   * @returns {Promise<void>}
   */
  async release() {
    try {
      await this.client?.quit()
    } finally {
      // ignore disconnection errors
      this.client = null
    }
  }

  /**
   * Lists all models with pagination.
   * @param {object} args - list arguments, including:
   * @param {number} [args.from = 0] - 0-based index of the first result
   * @param {number} [args.size = 10] - maximum number of models returned after first results.
   * @returns {Promise<Page>} a given page of models.
   */
  async list({ from = 0, size = 10 } = {}) {
    let results = []
    let total = 0
    if (this.client) {
      const ids = await this.client.zrange(this.indexKey, from, from + size - 1)
      results = (await this.getById(ids)).filter(Boolean)
      total = await this.client.zcard(this.indexKey)
    }
    return { total, from, size, results }
  }

  /**
   * Get a single or several model by their id.
   * @param {string|string[]} id - desired id(s).
   * @returns {Promise<object|null>|Promise<(object|null)[]>} matching model(s), or null(s).
   */
  async getById(id) {
    const ids = Array.isArray(id) ? id : [id]
    const results = []
    if (this.client && ids.length) {
      for (const id of ids) {
        results.push(await this._fetchModel(this._buildKey(id)))
      }
    }
    return Array.isArray(id) ? results : results[0]
  }

  /**
   * Fetches and rebuild a JSON model from Redis.
   * Allows subclasses to control how the data is stored on Redis.
   * The default implementation hydrates a Redis hash into an JSON object: all its properties are strings.
   * @param {string} key - the Redis key.
   * @returns {Promise<object>} the corresponding model.
   */
  async _fetchModel(key) {
    const data = await this.client.hgetall(key)
    if (!data.id) {
      return null
    }
    for (const { name, deserialize } of this.constructor.fields) {
      if (name in data) {
        data[name] = deserialize(data[name])
      }
    }
    return data
  }

  /**
   * Saves given model to storage.
   * It creates new model when needed, and updates existing ones (based on provided id).
   * Partial update is supported: incoming data is merged with previous (top level properties only).
   * Time complexity if O(2N + 1) + M * O(log(T)), with N saved records, M newly saved records, T total of records.
   * @param {object|object[]} data - single or array of saved (partial) models.
   * @returns {Promise<object|object[]>} single or array of saved models.
   */
  async save(data) {
    const records = Array.isArray(data) ? data : [data]
    const models = []
    if (this.client && records.length) {
      const ids = []
      for (const record of records) {
        if (!record.id) {
          record.id = randomUUID()
        }
        ids.push(record.id)
      }
      await this.client.watch(ids.map(this._buildKey.bind(this)))
      const existings = await this.getById(ids)
      const indexed = []
      const transaction = this.client.multi()
      for (const [index, record] of records.entries()) {
        if (!existings[index]) {
          indexed.push(this.nextScore++, record.id)
          existings[index] = {}
        }
        const model = Object.assign({}, existings[index], record)
        models.push(model)
        this._saveModel({ key: this._buildKey(model.id), model, transaction })
      }
      await (
        await this._enrichSaveTransaction({
          transaction,
          models,
          existings,
          indexed
        })
      ).exec()
    }
    return Array.isArray(data) ? models : models[0]
  }

  /**
   * Enrich the save transaction for saving a single model.
   * Allows subclasses to control how the data is stored on Redis.
   * This default implementation stringifies the whole model.
   * @param {SaveModelContext} context - the save operation context.
   */
  _saveModel({ key, model, transaction }) {
    transaction.hset(key, model)
  }

  /**
   * Records new models into the index.
   * Allows subclasses to tweak the Redis transaction used to save records.
   * @private
   * @param {SaveTransactionContext} context - contextual information.
   * @returns {Transaction|Promise<Transaction>} the applied transaction.
   */
  _enrichSaveTransaction({ transaction, indexed }) {
    if (indexed.length) {
      transaction
        .set(this.scoreKey, this.nextScore)
        .zadd(this.indexKey, ...indexed)
    }
    return transaction
  }

  /**
   * Deletes models by their ids.
   * Unmatching ids will be simply ignored and null will be returned instead.
   * @param {string|string[]} ids - ids of removed models.
   * @returns {Promise<object|null>|Promise<[object|null]>} single or array of removed models and nulls.
   */
  async deleteById(ids) {
    const recordIds = Array.isArray(ids) ? ids : [ids]
    let models = []
    if (this.client && recordIds.length) {
      const keys = recordIds.map(this._buildKey.bind(this)).filter(Boolean)
      if (keys.length) {
        models = await this.getById(recordIds)
        const transaction = this.client.multi().del(...keys)
        await (
          await this._enrichDeleteTransaction({
            keys,
            models,
            transaction
          })
        ).exec()
      }
    }
    return Array.isArray(ids) ? models : models[0]
  }

  /**
   * Removes models from the index.
   * Allows subclasses to tweak the Redis transaction used to delete records.
   * @private
   * @param {DeleteTransactionContext} context - contextual information.
   * @returns {Transaction|Promise<Transaction>} the applied transaction.
   */
  _enrichDeleteTransaction({ transaction, models }) {
    const ids = models.map(model => model?.id).filter(Boolean)
    return ids.length ? transaction.zrem(this.indexKey, ...ids) : transaction
  }
}

/**
 * Deserializer for boolean values.
 * @param {string} value - serialized boolean.
 * @returns {boolean} the corresponding boolean.
 */
export function deserializeBoolean(value) {
  return value === 'true'
}

/**
 * Deserializer for number values.
 * @param {string} value - serialized number.
 * @returns {number} the corresponding number.
 */
export const deserializeNumber = parseFloat

/**
 * Deserializer for array values.
 * @param {string} value - serialized array.
 * @returns {array} the corresponding array.
 */
export function deserializeArray(value) {
  return (value ?? '').split(',').filter(Boolean)
}
