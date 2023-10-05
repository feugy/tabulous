// @ts-check
import { Observable } from '@babylonjs/core/Misc/observable.js'

import { makeLogger } from '../../utils'

const logger = makeLogger('rule')

export class RuleManager {
  /**
   * Builds a manager to orchestrate replaying, backward and forward, history records.
   * Invokes init() before any other function.
   * @param {object} params - parameters, including:
   * @param {import('@babylonjs/core').Engine} params.engine - 3d engine.
   */
  constructor({ engine }) {
    /** game engine. */
    this.engine = engine
    /** @type {import('@src/graphql').LightPlayer[]} ordered list of player. */
    this.players = []
    /** @type {import('@tabulous/types').PlayerPreference[]} preferences for all players. */
    this.preferences = []
    /** @type {Observable<import('@tabulous/types').Scores>} emits on score changes. */
    this.onScoreUpdateObservable = new Observable()
    /** @internal @type {import('@babylonjs/core').Observer<import('@tabulous/types').ActionOrMove>?} */
    this.actionObserver = null
    /** @internal @type {?{ computeScore: import('@tabulous/types').ComputeScore }} */
    this.ruleEngine = null

    this.engine.onDisposeObservable.addOnce(() => this.dispose())
  }

  /**
   * Initializes with game rules, by loading the rule script into the document's head.
   * Connects to the control manager to evaluate rules.
   * @param {object} params - parameters, including:
   * @param {import('@src/3d/managers').Managers} params.managers - current managers.
   * @param {string} [params.engineScript] - bundled rule engine, if any.
   * @param {import('@src/graphql').LightPlayer[]} [params.players] - list of players.
   * @param {import('@tabulous/types').PlayerPreference[]} [params.preferences] - list of player preferences.
   */
  async init({ managers, engineScript, ...updateParams }) {
    this.dispose()
    this.managers = managers
    this.update(updateParams)

    if (engineScript) {
      logger.debug({ engineScript }, 'loading rules script')
      this.ruleEngine = new Function(`${engineScript};return engine`)()
      // await loadRulesScript(this, gameAssetsUrl, kind)
      this.actionObserver = managers.control.onActionObservable.add(action =>
        evaluateScore(this, action)
      )
      this.engine.onLoadingObservable.addOnce(() => evaluateScore(this, null))
    }
    logger.info({ ruleEngine: this.ruleEngine }, 'rule manager initialized')
  }

  /**
   * Update the list of player, only retaining the active ones.
   * @param {object} params - parameters, including
   * @param {import('@src/graphql').LightPlayer[]} [params.players] - list of players.
   * @param {import('@tabulous/types').PlayerPreference[]} [params.preferences] - list of player preferences.
   */
  update({ players, preferences }) {
    this.players = players?.filter(({ isGuest }) => !isGuest) ?? []
    this.preferences = preferences ?? []
  }

  /**
   * Unregisters from other managers, and removes added script.
   */
  dispose() {
    if (this.actionObserver) {
      this.managers?.control.onActionObservable.remove(this.actionObserver)
      this.actionObserver = null
    }
    this.ruleEngine = null
  }
}

async function evaluateScore(
  /** @type {RuleManager} */ {
    ruleEngine,
    engine,
    players,
    preferences,
    onScoreUpdateObservable
  },
  /** @type {?import('@tabulous/types').ActionOrMove} */ action
) {
  if (action && !('fn' in action)) {
    return
  }
  try {
    const scores = await ruleEngine?.computeScore?.(
      action,
      engine.serialize(),
      players,
      preferences
    )
    if (scores) {
      onScoreUpdateObservable.notifyObservers(scores)
    }
  } catch (error) {
    logger.warn({ error, action }, `failed to evaluate score`)
  }
}
