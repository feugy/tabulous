// @ts-check
/**
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@babylonjs/core').Observer<Action|Move>} Observer
 * @typedef {import('@src/3d/managers').Action} Action
 * @typedef {import('@src/3d/managers').Move} Move
 * @typedef {import('@tabulous/server/src/graphql').ActionName} ActionName
 * @typedef {import('@tabulous/server/src/graphql').HistoryRecord} HistoryRecord
 */

import { Observable } from '@babylonjs/core/Misc/observable.js'

import { makeLogger } from '../../utils'
import { actionNames } from '../utils/actions'

const logger = makeLogger('replay')

export class ReplayManager {
  /**
   * Builds a manager to orchestrate replaying, backward and forward, history records.
   * Invokes init() before any other function.
   * @param {object} params - parameters, including:
   * @param {Engine} params.engine - 3d engine.
   */
  constructor({ engine }) {
    /** game engin. */
    this.engine = engine
    /** @type {HistoryRecord[]} list of available history records. */
    this.history = []
    /** @type {number} current rank when replaying records */
    this.rank = 0
    /** @type {ReturnType<Engine['serialize']>?} */
    this._save = null
    /** @type {Observable<HistoryRecord[]>} emits when history has changed. */
    this.onHistoryObservable = new Observable()
    /** @type {Observable<number>} emits when the replay ranks is modified. */
    this.onReplayRankObservable = new Observable()
    /** @type {Observer?} */
    this.actionObserver
    /** @internal avoid concurrent replays */
    this.inhibitReplay = false
    /** @internal */
    this.moveDuration = 200
    /** @internal @type {import('@src/3d/managers').Managers} */
    this.managers

    this.engine.onDisposeObservable.addOnce(() => {
      this.managers?.control.onActionObservable.remove(this.actionObserver)
      this.onHistoryObservable.clear()
      this.onReplayRankObservable.clear()
    })
  }

  /**
   * Initializes with game data.
   * Set the initial history, and connects to the control manager to record new local actions.
   * @param {object} params - parameters, including:
   * @param {string} params.playerId - id of the local player.
   * @param {import('@src/3d/managers').Managers} params.managers - current managers.
   * @param {HistoryRecord[]} [params.history] - initial history.
   */
  init({ managers, history = [], playerId }) {
    this.managers = managers
    this.reset(history)
    this.actionObserver = managers.control.onActionObservable.add(action => {
      if (!('isLocal' in action) || !action.isLocal) {
        this.record(action, playerId)
      }
    })
    logger.debug({ history, rank: this.rank }, 'replay manager initialized')
  }

  /** Whether a replay is in progress. */
  get isReplaying() {
    return this.rank < this.history.length
  }

  /** Serialized engine, if replay is in progress. */
  get save() {
    return this.isReplaying ? this._save : null
  }

  /**
   * Reset records and rank, and notifies listeners.
   * @param {HistoryRecord[]} [history] - history content.
   */
  reset(history = []) {
    this.history = history
    this.rank = this.history.length
    this.onHistoryObservable.notifyObservers(this.history)
    this.onReplayRankObservable.notifyObservers(this.rank)
  }

  /**
   * Record a new action or move into history.
   * It collapses redundant moves together and notifies listeners.
   * Only updates current rank if it was on last.
   * @param {Action|Move} record - received record.
   * @param {string} playerId - id of the player who sent the record.
   */
  record(record, playerId) {
    if (!record.fromHand && ('pos' in record || !record.isLocal)) {
      logger.debug(
        { record, history: this.history, rank: this.rank },
        'adding to the history'
      )
      const needsRankUpdate = this.rank === this.history.length
      /** @type {HistoryRecord} */
      const result =
        'fn' in record
          ? {
              fn: /** @type {ActionName} */ (record.fn),
              argsStr: JSON.stringify(record.args),
              revertStr: record.revert
                ? JSON.stringify(record.revert)
                : undefined,
              meshId: record.meshId,
              duration: record.duration,
              time: Date.now(),
              playerId
            }
          : {
              pos: record.pos,
              prev: record.prev,
              meshId: record.meshId,
              duration: record.duration,
              time: Date.now(),
              playerId
            }
      this.history = collapseAndAppendHistory(this.history, result)
      if (needsRankUpdate) {
        this.rank = this.history.length
        this.onReplayRankObservable.notifyObservers(this.rank)
      }
      this.onHistoryObservable.notifyObservers(this.history)
    }
  }

  /**
   * Replay all records from current state until the specified one.
   * @param {number} untilRank - rank until which records should be applied or reverted.
   */
  async replayHistory(untilRank) {
    if (this.inhibitReplay) {
      return
    }
    this.inhibitReplay = true
    if (!this.isReplaying) {
      this._save = this.engine.serialize()
    }
    if (untilRank >= 0 && untilRank < this.history.length) {
      const reverting = this.rank > untilRank
      do {
        if (reverting) {
          this.rank--
          this.onReplayRankObservable.notifyObservers(this.rank)
        }
        await apply(this, this.history[this.rank], reverting)
        if (!reverting) {
          this.rank++
          this.onReplayRankObservable.notifyObservers(this.rank)
        }
      } while (this.rank != (reverting ? untilRank : untilRank + 1))
    }
    this.inhibitReplay = false
  }
}

/**
 * Apply or revert a given revord.
 * @param {ReplayManager} manager - current manager.
 * @param {HistoryRecord} record - concerned record.
 * @param {boolean} [reverting] - whether the record should be reverted (true) or applied (false).
 */
async function apply({ moveDuration, managers }, record, reverting = false) {
  logger.debug({ record, reverting }, 'replaying record')

  if ('prev' in record && record.prev) {
    if (reverting) {
      await managers.control.revert({
        ...record,
        duration: moveDuration
      })
    } else {
      await managers.control.apply({ ...record, duration: moveDuration })
    }
  } else if ('fn' in record && record.fn) {
    if (reverting) {
      // delegate reverting action with behavior
      const args = record.revertStr
        ? JSON.parse(record.revertStr)
        : record.argsStr
        ? JSON.parse(record.argsStr)
        : []
      await managers.control.revert({ ...record, args })
    } else {
      await managers.control.apply({
        ...record,
        args:
          'argsStr' in record && record.argsStr
            ? JSON.parse(record.argsStr)
            : undefined
      })
    }
  }
}

/**
 * Appends a record to history. Also handles these cases:
 * - when moving a mesh, if this mesh's previous action is a move by the same player, then collapse moves.
 * - when moving a mesh, if this mesh's previous action is a draw by the same player, then ignore the move.
 * - when playing a mesh, if this mesh's previous action is a move by the same player, then ignore the move.
 * @param {HistoryRecord[]} history - history of records.
 * @param {HistoryRecord} added - candidate record to add.
 * @returns the collapsed history.
 */
function collapseAndAppendHistory(history, added) {
  let add = true
  if (
    'pos' in added ||
    added.fn === actionNames.draw ||
    added.fn === actionNames.play
  ) {
    const previousIdx = history.findLastIndex(
      record => record.meshId === added.meshId
    )
    if (previousIdx >= 0) {
      const previous = history[previousIdx]
      if ('pos' in added) {
        if ('pos' in previous && previous.playerId === added.playerId) {
          // collapses moves together: updates `prev` but keeps `pos`
          added.prev = previous.prev
          history.splice(previousIdx, 1)
        } else if (
          'fn' in previous &&
          previous.fn === actionNames.draw &&
          previous.playerId === added.playerId
        ) {
          // ignore moves after draw
          add = false
        }
      } else if (added.fn === actionNames.play) {
        if ('pos' in previous && previous.playerId === added.playerId) {
          // ignore moves before play
          history.splice(previousIdx, 1)
        }
      }
    }
  }
  if (add) {
    history.push(added)
  }
  return history
}
