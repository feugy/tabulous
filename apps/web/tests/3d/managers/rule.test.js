// @ts-check
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { configures3dTestEngine, mockLogger } from '../../test-utils'

describe('ReplayManager', () => {
  /** @type {import('@babylonjs/core').Engine} */
  let engine
  /** @type {?import('@tabulous/types').Scores} */
  let scores = null
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  /** @type {string} */
  let playerId

  const logger = mockLogger('rule')

  configures3dTestEngine(
    created => {
      ;({ engine, playerId, managers } = created)
      engine.serialize = vi.fn()
      managers.rule.onScoreUpdateObservable.add(data => (scores = data))
    },
    { isSimulation: globalThis.use3dSimulation }
  )

  beforeEach(() => {
    vi.clearAllMocks()
    scores = null
  })

  it('has initial state', () => {
    expect(managers.rule.engine).toBe(engine)
    expect(managers.rule.players).toEqual([])
    expect(managers.rule.ruleEngine).toBeNull()
  })

  describe('init()', () => {
    it('handles the lack of rule engine', async () => {
      const players = [{ id: playerId, username: 'John', currentGameId: null }]
      managers.rule.init({ managers, players })
      expect(managers.rule.ruleEngine).toBeNull()
      expect(managers.rule.players).toEqual(players)
      await engine.onLoadingObservable.notifyObservers(false)
      expect(scores).toBeNull()
    })

    it('initializes engine script and compute score on load', async () => {
      const engineScript = `var engine={computeScore:()=>({"${playerId}":{total:1}})}`
      const players = [{ id: playerId, username: 'John', currentGameId: null }]
      managers.rule.init({ managers, engineScript, players })
      expect(managers.rule.ruleEngine).toEqual({
        computeScore: expect.any(Function)
      })
      expect(managers.rule.players).toEqual(players)
      await engine.onLoadingObservable.notifyObservers(false)
      expect(scores).toEqual({ [playerId]: { total: 1 } })
    })
  })

  it('computes scores on every action', async () => {
    const engineScript = `let count=0;let engine={computeScore:(action)=>action?.fn==='flip'?{"${playerId}":{total:++count}}:undefined}`
    managers.rule.init({ managers, engineScript })
    await managers.control.onActionObservable.notifyObservers({
      meshId: 'box',
      fromHand: false,
      fn: 'flip',
      args: []
    })
    expect(scores).toEqual({ [playerId]: { total: 1 } })
    await managers.control.onActionObservable.notifyObservers({
      meshId: 'box',
      fromHand: false,
      fn: 'flip',
      args: []
    })
    expect(scores).toEqual({ [playerId]: { total: 2 } })
  })

  it('does computes scores on moves', async () => {
    const engineScript = `let engine={computeScore:()=>({"${playerId}":{total:1}})}`
    managers.rule.init({ managers, engineScript })
    await managers.control.onActionObservable.notifyObservers({
      meshId: 'box',
      fromHand: false,
      pos: [1, 0, 0],
      prev: [0, 0, 0]
    })
    expect(scores).toBeNull()
    await managers.control.onActionObservable.notifyObservers({
      meshId: 'box',
      fromHand: false,
      pos: [2, 0, 0],
      prev: [1, 0, 0]
    })
    expect(scores).toBeNull()
  })

  it('handles score computation error', async () => {
    const engineScript = `let engine={computeScore:()=>{throw new Error('boom')}}`
    managers.rule.init({ managers, engineScript })
    const action = {
      meshId: 'box',
      fromHand: false,
      fn: /** @type {const} */ ('flip'),
      args: []
    }
    await managers.control.onActionObservable.notifyObservers(action)
    expect(scores).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      { action, error: new Error('boom') },
      'failed to evaluate score'
    )
    expect(logger.warn).toHaveBeenCalledOnce()
  })
})
