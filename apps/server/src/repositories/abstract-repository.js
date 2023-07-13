// @ts-check
import { randomUUID } from 'node:crypto'

import Redis from 'ioredis'

import { makeLogger } from '../utils/index.js'

/**
 * @typedef {import('ioredis').ChainableCommander} Transaction
 */

/**
 * @template {object} T
 * @typedef {object} Page
 * @property {number} total - total number of models.
 * @property {number} size - 0-based rank of the first model returned.
 * @property {number} from - maximum number of models per page.
 * @property {T[]} results - returned models.
 */

/**
 * @template {object} T
 * @typedef {object} DeleteTransactionContext
 * @property {Transaction} transaction - deletion transaction.
 * @property {(?T)[]} models - array of deleted record object.
 * @property {string[]} keys - array of deleted Redis keys.
 */

/**
 * @template {object} T
 * @typedef {object} SaveTransactionContext
 * @property {Transaction} transaction - save transaction.
 * @property {T[]} models - array of saved models.
 * @property {(?T)[]} existings - array of pre-existing models.
 * @property {(number | string)[]} indexed - for newly inserted models, their score and id.
 */

/**
 * @template {object} T
 * @typedef {object} SaveModelContext
 * @property {Transaction} transaction - save transaction.
 * @property {T} model - saved model.
 * @property {string} key - Redis key for this model.
 */

/**
 * @typedef {object} FieldDescriptor
 * @property {string} name - the field name.
 * @property {(value: string) => any} deserialize - function used to deserialize string values from Redis into JSON values.
 */

/**
 * @template {{ id: string }} T
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
   */
  constructor({ name }) {
    if (!name) {
      throw new Error(`every repository needs a name`)
    }
    this.name = name
    /** @type {?Redis} */
    this.client = null
    this.nextScore = 0
    this.scoreKey = `score:${this.name}`
    this.indexKey = `index:${this.name}`
    this.logger = makeLogger(`${this.name}-repository`, {
      ctx: { name: this.name }
    })
  }

  /**
   * Builds the key of a given model of this repository
   * @protected
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
      const ctx = { url, scoreKey: this.scoreKey, indexKey: this.indexKey }
      this.logger.trace({ ctx }, 'connecting repository to Redis')
      this.client = await /** @type {Promise<Redis>} */ (
        new Promise((resolve, reject) => {
          const client = new Redis(url, {
            enableAutoPipelining: true,
            enableReadyCheck: false,
            showFriendlyErrorStack: !isProduction
          })
          client.once('connect', () => {
            client.removeAllListeners('error')
            resolve(client)
          })
          client.once('error', error => {
            client.removeAllListeners('connect')
            reject(
              new Error(
                `Failed to connect repository ${this.name}: ${error.message}`
              )
            )
          })
        })
      )
      this.nextScore = parseInt((await this.client.get(this.scoreKey)) || '0')
      this.logger.info(
        { ctx: { ...ctx, nextScore: this.nextScore } },
        'connected repository to Redis'
      )
    }
  }

  /**
   * Tears the repository down to release its connection.
   * @returns {Promise<void>}
   */
  async release() {
    this.logger.trace('releasing Redis connection')
    try {
      await this.client?.quit()
    } finally {
      // ignore disconnection errors
      this.client = null
    }
    this.logger.info('released Redis connection')
  }

  /**
   * Lists all models with pagination.
   * @param {object} args - list arguments, including:
   * @param {number} [args.from = 0] - 0-based index of the first result
   * @param {number} [args.size = 10] - maximum number of models returned after first results.
   * @returns {Promise<Page<T>>} a given page of models.
   */
  async list({ from = 0, size = 10 } = {}) {
    this.logger.trace({ ctx: { from, size } }, 'listing models')
    /** @type {T[]} */
    let results = []
    let total = 0
    if (this.client) {
      const ids = await this.client.zrange(this.indexKey, from, from + size - 1)
      results = /** @type {T[]} */ (await this.getById(ids)).filter(Boolean)
      total = await this.client.zcard(this.indexKey)
    }
    this.logger.debug(
      { ctx: { from, size, total }, res: results.map(({ id }) => id) },
      'listed models'
    )
    return { total, from, size, results }
  }

  /**
   * @overload
   * @param {(string|undefined)[]} [id]
   * @returns {Promise<(?T)[]>}
   */
  /**
   * @overload
   * @param {string} [id]
   * @returns {Promise<?T>}
   */
  /**
   * Get a single or several model by their id.
   * @param {string|(string|undefined)[]} [id] - desired id(s).
   * @returns {Promise<?T|(?T)[]>} matching model(s), or null(s).
   */
  async getById(id) {
    const ids = /** @type {string[]} */ (
      (Array.isArray(id) ? id : [id]).filter(Boolean)
    )
    this.logger.trace({ ctx: { ids } }, 'getting model(s) by id(s)')
    const results = []
    if (this.client && ids.length) {
      for (const id of ids) {
        results.push(await this._fetchModel(this._buildKey(id)))
      }
    }
    this.logger.debug(
      { ctx: { ids }, res: results.map(obj => Boolean(obj)) },
      'got model(s) by id id(s)'
    )
    return Array.isArray(id) ? results : results[0]
  }

  /**
   * Fetches and rebuild a JSON model from Redis.
   * Allows subclasses to control how the data is stored on Redis.
   * The default implementation hydrates a Redis hash into an JSON object: all its properties are strings.
   * @protected
   * @param {string} key - the Redis key.
   * @returns {Promise<?T>} the corresponding model.
   */
  async _fetchModel(key) {
    const data = await /** @type {Redis} */ (this.client).hgetall(key)
    if (!data.id) {
      return null
    }
    // @ts-expect-error: Property 'fields' does not exist on type 'Function'
    for (const { name, deserialize } of this.constructor.fields) {
      if (name in data) {
        data[name] = deserialize(data[name])
      }
    }
    return /** @type {T} */ (data)
  }

  /**
   * @overload
   * @param {Partial<T>} data
   * @returns {Promise<T>}
   */
  /**
   * @overload
   * @param {Partial<T>[]} data
   * @returns {Promise<T[]>}
   */
  /**
   * Saves given model to storage.
   * It creates new model when needed, and updates existing ones (based on provided id).
   * Partial update is supported: incoming data is merged with previous (top level properties only).
   * Time complexity if O(2N + 1) + M * O(log(T)), with N saved records, M newly saved records, T total of records.
   * @param {Partial<T>|Partial<T>[]} data - single or array of saved (partial) models.
   * @returns {Promise<T|T[]>} single or array of saved models.
   */
  async save(data) {
    const records = Array.isArray(data) ? data : [data]
    this.logger.trace({ ctx: { count: records.length } }, 'saving model(s)')
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
          indexed.push(this.nextScore++, /** @type {string} */ (record.id))
          existings[index] = /** @type {T} */ ({})
        }
        const model = Object.assign({}, existings[index], record)
        models.push(model)
        this._saveModel({ key: this._buildKey(model.id), model, transaction })
      }
      const maybePromise = this._enrichSaveTransaction({
        transaction,
        models,
        existings,
        indexed
      })
      const finalTransaction =
        maybePromise instanceof Promise ? await maybePromise : maybePromise
      await finalTransaction.exec()
      this.logger.debug(
        {
          ctx: {
            count: records.length,
            models: models.map(({ id }) => id),
            existings: existings.map(existing => existing?.id),
            indexed,
            transaction: serializeTransaction(finalTransaction)
          }
        },
        'saved model(s)'
      )
    }
    return Array.isArray(data) ? models : models[0]
  }

  /**
   * Enrich the save transaction for saving a single model.
   * Allows subclasses to control how the data is stored on Redis.
   * This default implementation stringifies the whole model.
   * @protected
   * @param {SaveModelContext<T>} context - the save operation context.
   */
  _saveModel({ key, model, transaction }) {
    transaction.hset(key, model)
  }

  /**
   * Records new models into the index.
   * Allows subclasses to tweak the Redis transaction used to save records.
   * @protected
   * @param {SaveTransactionContext<T>} context - contextual information.
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
   * @overload
   * @param {string[]} ids
   * @returns {Promise<(?T)[]>}
   */
  /**
   * @overload
   * @param {string} id
   * @returns {Promise<?T>}
   */
  /**
   * Deletes models by their ids.
   * Unmatching ids will be simply ignored and null will be returned instead.
   * @param {string|string[]} ids - ids of removed models.
   * @returns {Promise<?T|(?T)[]>} single or array of removed models and nulls.
   */
  async deleteById(ids) {
    const recordIds = Array.isArray(ids) ? ids : [ids]
    this.logger.trace({ ctx: { ids: recordIds } }, 'deleting model(s)')
    /** @type {(?T)[]} */
    let models = []
    if (this.client && recordIds.length) {
      const keys = recordIds.map(this._buildKey.bind(this)).filter(Boolean)
      if (keys.length) {
        models = await this.getById(recordIds)
        const transaction = this.client.multi().del(...keys)
        const maybePromise = this._enrichDeleteTransaction({
          keys,
          models,
          transaction
        })
        const finalTransaction =
          maybePromise instanceof Promise ? await maybePromise : maybePromise
        await finalTransaction.exec()
        this.logger.debug(
          {
            ctx: {
              ids: recordIds,
              keys,
              transaction: serializeTransaction(finalTransaction)
            }
          },
          'deleted model(s)'
        )
      }
    }
    return Array.isArray(ids) ? models : models[0]
  }

  /**
   * Removes models from the index.
   * Allows subclasses to tweak the Redis transaction used to delete records.
   * @protected
   * @param {DeleteTransactionContext<T>} context - contextual information.
   * @returns {Transaction|Promise<Transaction>} the applied transaction.
   */
  _enrichDeleteTransaction({ transaction, models }) {
    const ids = /** @type {string[]} */ (
      models.map(model => model?.id).filter(Boolean)
    )
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
 * @returns {string[]} the corresponding array.
 */
export function deserializeArray(value) {
  return (value ?? '').split(',').filter(Boolean)
}

/**
 * @param {Transaction} transaction - Transaction to serialize.
 * @returns {string} serialized version of the transaction.
 */
function serializeTransaction(transaction) {
  const commands = []
  // @ts-ignore
  for (const { name, args } of transaction._queue) {
    commands.push(`${name}${args?.length ? ' ' + args.join(' ') : ''}`)
  }
  return commands.join(' > ')
}
