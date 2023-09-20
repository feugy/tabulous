// @ts-check
/**
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/managers').Action} Action
 * @typedef {import('@tabulous/server/src/graphql').HistoryRecord} HistoryRecord
 * @typedef {import('@tabulous/server/src/graphql').Mesh} SerializedMesh
 */
/**
 * @template {any[]} P, R
 * @typedef {import('vitest').SpyInstance<P, R>} SpyInstance
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { createCard } from '@src/3d/meshes'
import { animateMove } from '@src/3d/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { configures3dTestEngine } from '../../test-utils'

describe('managers.Control', () => {
  /** @type {Engine} */
  let engine
  /** @type {Scene} */
  let scene
  /** @type {Mesh} */
  let mesh
  /** @type {Mesh} */
  let mesh2
  /** @type {HistoryRecord[]} */
  let history
  let rank = 0
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  /** @type {string} */
  let playerId

  configures3dTestEngine(created => {
    ;({ engine, scene, managers, playerId } = created)
    engine.serialize = vi.fn()
    managers.replay.onHistoryObservable.add(data => (history = data))
    managers.replay.onReplayRankObservable.add(value => (rank = value))
    managers.replay.init({ managers, history: [], playerId })
    managers.hand.enabled = true
    expect(rank).toBe(0)
    expect(history).toEqual([])
  })

  beforeEach(() => {
    vi.clearAllMocks()
    managers.replay.reset()
    mesh = createCard(
      { id: 'box1', texture: '', flippable: {}, rotable: {}, drawable: {} },
      managers,
      scene
    )
    mesh2 = createCard(
      { id: 'box2', texture: '', flippable: {}, rotable: {}, drawable: {} },
      managers,
      scene
    )
  })

  describe('given initialized with empty history', () => {
    it('is not replaying', () => {
      expect(managers.replay.isReplaying).toBe(false)
      expect(managers.replay.save).toBeNull()
      expect(rank).toBe(0)
      expect(history).toEqual([])
    })

    it('can not replay history', async () => {
      await managers.replay.replayHistory(0)
      await managers.replay.replayHistory(10)
      expect(managers.replay.isReplaying).toBe(false)
      expect(managers.replay.save).toBeNull()
      expect(rank).toBe(0)
      expect(history).toEqual([])
    })

    describe('record()', () => {
      /** @type {number} */
      let currentRank

      beforeEach(() => {
        currentRank = managers.replay.rank
      })

      it('records moves', () => {
        const move = {
          meshId: mesh.id,
          pos: [0, 0, 0],
          prev: [1, 1, 1]
        }
        managers.replay.record({ ...move, fromHand: false }, playerId)
        expect(history[0]).toEqual({
          ...move,
          time: expect.any(Number),
          playerId
        })
        expect(rank).toBe(currentRank + 1)
        expect(managers.replay.rank).toBe(currentRank + 1)
      })

      it('records action with no revert', () => {
        /** @type {Omit<Action, 'fromHand'>} */
        const action = {
          meshId: mesh.id,
          fn: 'flip',
          args: []
        }
        managers.replay.record({ ...action, fromHand: false }, playerId)
        expect(history[0]).toEqual({
          ...action,
          args: undefined,
          argsStr: '[]',
          time: expect.any(Number),
          playerId
        })
        expect(rank).toBe(currentRank + 1)
        expect(managers.replay.rank).toBe(currentRank + 1)
      })

      it('can record action with revert', () => {
        /** @type {Omit<Action, 'fromHand'>} */
        const action = {
          meshId: mesh.id,
          fn: 'push',
          args: [mesh2.id, false],
          revert: [1, false, [0, 1, 2], 0]
        }
        managers.replay.record({ ...action, fromHand: false }, playerId)
        expect(history[0]).toEqual({
          ...action,
          args: undefined,
          argsStr: JSON.stringify(action.args),
          revert: undefined,
          revertStr: JSON.stringify(action.revert),
          time: expect.any(Number),
          playerId
        })
        expect(rank).toBe(currentRank + 1)
        expect(managers.replay.rank).toBe(currentRank + 1)
      })

      it('automatically records action', async () => {
        await mesh.metadata.flip?.()
        expect(history[0]).toEqual({
          meshId: mesh.id,
          fn: 'flip',
          argsStr: '[]',
          duration: 500,
          time: expect.any(Number),
          playerId
        })
        expect(rank).toBe(currentRank + 1)
        expect(managers.replay.rank).toBe(currentRank + 1)
      })

      it('ignores local actions', async () => {
        await managers.control.apply({ meshId: mesh.id, fn: 'flip', args: [] })
        expect(history).toHaveLength(0)
        expect(rank).toBe(currentRank)
        expect(managers.replay.rank).toBe(currentRank)
      })

      it('ignores actions from hand', async () => {
        const action = { meshId: mesh.id, pos: [0, 0, 0], prev: [0, 0, 0] }
        managers.replay.record({ ...action, fromHand: true }, playerId)
        expect(history).toHaveLength(0)
        expect(rank).toBe(currentRank)
        expect(managers.replay.rank).toBe(currentRank)
      })

      it('collapses moves together', () => {
        const playerId2 = 'player2'
        const move1_1 = { meshId: mesh.id, pos: [1, 0.5, 1], prev: [0, 0, 0] }
        const move1_2 = { meshId: mesh.id, pos: [2, 0.5, 2], prev: [1, 0.5, 1] }
        const move1_3 = { meshId: mesh.id, pos: [3, 0.5, 3], prev: [2, 0.5, 2] }
        const move2_1 = {
          meshId: mesh2.id,
          pos: [-1, 0.5, -1],
          prev: [0, 0, 0]
        }
        const move2_2 = {
          meshId: mesh2.id,
          pos: [-2, 0.5, -2],
          prev: [-1, 0.5, -1]
        }
        const move2_3 = {
          meshId: mesh2.id,
          pos: [-3, 0.5, -3],
          prev: [-2, 0.5, -2]
        }

        managers.replay.record({ ...move1_1, fromHand: false }, playerId)
        managers.replay.record({ ...move2_1, fromHand: false }, playerId2)
        expect(history).toEqual([
          {
            ...move1_1,
            time: expect.any(Number),
            playerId
          },
          {
            ...move2_1,
            time: expect.any(Number),
            playerId: playerId2
          }
        ])

        managers.replay.record({ ...move1_2, fromHand: false }, playerId) // collapse with 1_1
        expect(history).toEqual([
          { ...move2_1, time: expect.any(Number), playerId: playerId2 },
          { ...move1_2, prev: move1_1.prev, time: expect.any(Number), playerId }
        ])

        managers.replay.record({ ...move2_2, fromHand: false }, playerId)
        expect(history).toEqual([
          { ...move2_1, time: expect.any(Number), playerId: playerId2 },
          {
            ...move1_2,
            prev: move1_1.prev,
            time: expect.any(Number),
            playerId
          },
          { ...move2_2, time: expect.any(Number), playerId }
        ])

        managers.replay.record({ ...move1_3, fromHand: false }, playerId2)
        expect(history).toEqual([
          { ...move2_1, time: expect.any(Number), playerId: playerId2 },
          {
            ...move1_2,
            prev: move1_1.prev,
            time: expect.any(Number),
            playerId
          },
          { ...move2_2, time: expect.any(Number), playerId },
          { ...move1_3, time: expect.any(Number), playerId: playerId2 }
        ])

        managers.replay.record({ ...move2_3, fromHand: false }, playerId) // collapse with 2_2
        expect(history).toEqual([
          { ...move2_1, time: expect.any(Number), playerId: playerId2 },
          {
            ...move1_2,
            prev: move1_1.prev,
            time: expect.any(Number),
            playerId
          },
          { ...move1_3, time: expect.any(Number), playerId: playerId2 },
          { ...move2_3, prev: move2_2.prev, time: expect.any(Number), playerId }
        ])
      })

      it('ignores moves following a draw', () => {
        const playerId2 = 'player2'
        const move1_1 = { meshId: mesh.id, pos: [1, 0.5, 1], prev: [0, 0, 0] }
        /** @type {Omit<Action, 'fromHand'>} */
        const draw1 = { meshId: mesh.id, args: [], fn: 'draw' }
        const move1_2 = { meshId: mesh.id, pos: [2, 0.5, 2], prev: [1, 0.5, 1] }
        const move2_1 = {
          meshId: mesh2.id,
          pos: [-1, 0.5, -1],
          prev: [0, 0, 0]
        }
        /** @type {Omit<Action, 'fromHand'>} */
        const draw2 = { meshId: mesh2.id, args: [], fn: 'draw' }
        const move2_2 = {
          meshId: mesh2.id,
          pos: [-2, 0.5, -2],
          prev: [-1, 0.5, -1]
        }

        managers.replay.record({ ...move1_1, fromHand: false }, playerId)
        managers.replay.record({ ...move2_1, fromHand: false }, playerId2)
        managers.replay.record({ ...draw2, fromHand: false }, playerId2)
        managers.replay.record({ ...draw1, fromHand: false }, playerId)
        managers.replay.record({ ...move1_2, fromHand: false }, playerId)
        managers.replay.record({ ...move2_2, fromHand: false }, playerId2)
        expect(history).toEqual([
          { ...move1_1, time: expect.any(Number), playerId },
          { ...move2_1, time: expect.any(Number), playerId: playerId2 },
          {
            ...draw2,
            args: undefined,
            argsStr: '[]',
            time: expect.any(Number),
            playerId: playerId2
          },
          {
            ...draw1,
            args: undefined,
            argsStr: '[]',
            time: expect.any(Number),
            playerId
          }
        ])
      })

      it('ignores moves preceding a play', () => {
        const playerId2 = 'player2'
        const move1_1 = { meshId: mesh.id, pos: [1, 0.5, 1], prev: [0, 0, 0] }
        /** @type {Omit<Action, 'fromHand'>} */
        const play1 = { meshId: mesh.id, args: [], fn: 'play' }
        const move1_2 = { meshId: mesh.id, pos: [2, 0.5, 2], prev: [1, 0.5, 1] }
        const move2_1 = {
          meshId: mesh2.id,
          pos: [-1, 0.5, -1],
          prev: [0, 0, 0]
        }
        /** @type {Omit<Action, 'fromHand'>} */
        const play2 = { meshId: mesh2.id, args: [], fn: 'play' }
        const move2_2 = {
          meshId: mesh2.id,
          pos: [-2, 0.5, -2],
          prev: [-1, 0.5, -1]
        }

        managers.replay.record({ ...move1_1, fromHand: false }, playerId)
        managers.replay.record({ ...move2_1, fromHand: false }, playerId2)
        managers.replay.record({ ...play2, fromHand: false }, playerId2)
        managers.replay.record({ ...play1, fromHand: false }, playerId)
        managers.replay.record({ ...move1_2, fromHand: false }, playerId)
        managers.replay.record({ ...move2_2, fromHand: false }, playerId2)
        expect(history).toEqual([
          {
            ...play2,
            args: undefined,
            argsStr: '[]',
            time: expect.any(Number),
            playerId: playerId2
          },
          {
            ...play1,
            args: undefined,
            argsStr: '[]',
            time: expect.any(Number),
            playerId
          },
          { ...move1_2, time: expect.any(Number), playerId },
          { ...move2_2, time: expect.any(Number), playerId: playerId2 }
        ])
      })
    })

    describe('replayHistory()', () => {
      const states = new Map()

      function makeComparable(
        /** @type {SerializedMesh|undefined} */ state,
        approx = false
      ) {
        return state
          ? { ...state, y: approx ? expect.numberCloseTo(state.y, 2) : state.y }
          : 'drawn'
      }

      function getStates(approx = false) {
        return {
          state1: makeComparable(
            scene.getMeshById(mesh?.id)?.metadata.serialize(),
            approx
          ),
          state2: makeComparable(
            scene.getMeshById(mesh2?.id)?.metadata.serialize(),
            approx
          )
        }
      }

      function addState(name = 'initial') {
        states.set(name, getStates())
      }

      beforeEach(async () => {
        addState()
        let prev = mesh.absolutePosition.asArray()
        await animateMove(mesh, Vector3.FromArray([1, 0, 2]), null)
        managers.control.record({
          mesh,
          pos: mesh.absolutePosition.asArray(),
          prev
        })
        addState('moved1')
        await mesh.metadata.flip?.()
        addState('flipped1')
        prev = mesh.absolutePosition.asArray()
        await animateMove(mesh, Vector3.FromArray([-2, 0, 2]), null)
        managers.control.record({
          mesh,
          pos: mesh.absolutePosition.asArray(),
          prev
        })
        addState('moved2')
        await mesh2.metadata.rotate?.()
        addState('rotated1')
        await mesh2.metadata.draw?.()
        addState('drawn2')
      })

      it('can replay backwards', async () => {
        await managers.replay.replayHistory(2)
        expect(rank).toBe(2)
        expect(getStates(true)).toEqual(states.get('flipped1'))
        await managers.replay.replayHistory(0)
        expect(rank).toBe(0)
        expect(getStates(true)).toEqual(states.get('initial'))
      })

      it('can not replay less than 0', async () => {
        await managers.replay.replayHistory(1)
        expect(rank).toBe(1)
        expect(getStates(true)).toEqual(states.get('moved1'))
        await managers.replay.replayHistory(-1)
        expect(rank).toBe(1)
        expect(getStates(true)).toEqual(states.get('moved1'))
      })

      it('can replay forwards', async () => {
        await managers.replay.replayHistory(1)
        expect(rank).toBe(1)
        expect(getStates(true)).toEqual(states.get('moved1'))
        await managers.replay.replayHistory(2)
        expect(rank).toBe(3)
        expect(getStates(true)).toEqual(states.get('moved2'))
        await managers.replay.replayHistory(3)
        expect(rank).toBe(4)
        expect(getStates(true)).toEqual(states.get('rotated1'))
      })

      it('can not replay more than history length', async () => {
        await managers.replay.replayHistory(10)
        expect(rank).toBe(history.length)
        expect(getStates(true)).toEqual(states.get('drawn2'))
      })

      it('can not replay concurrently', async () => {
        await Promise.all([
          managers.replay.replayHistory(1),
          managers.replay.replayHistory(2)
        ])
        expect(rank).toBe(1)
        expect(getStates(true)).toEqual(states.get('moved1'))
      })

      it('does not update rank when recording action', async () => {
        const length = history.length
        await managers.replay.replayHistory(1)
        expect(rank).toBe(1)
        expect(getStates(true)).toEqual(states.get('moved1'))
        await mesh.metadata.rotate?.()
        expect(rank).toBe(1)
        expect(history[length]).toEqual(
          expect.objectContaining({ meshId: mesh.id, fn: 'rotate' })
        )
      })
    })
  })
})
