// @ts-check
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Color4 } from '@babylonjs/core/Maths/math.color'
import { Logger } from '@babylonjs/core/Misc/logger'
import { faker } from '@faker-js/faker'
import { createEngine } from '@src/3d'
import { DrawBehaviorName } from '@src/3d/behaviors'
import { sleep } from '@src/utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { expectAnimationEnd } from '../test-utils'

describe('createEngine()', () => {
  /** @type {import('@babylonjs/core').Engine} */
  let engine
  const playerId = faker.string.uuid()
  const peerId1 = faker.string.uuid()
  const peerId2 = faker.string.uuid()
  const canvas = document.createElement('canvas')
  const interaction = document.createElement('div')
  const hand = document.createElement('div')
  const translate = (/** @type {string} */ key) => key

  beforeEach(() => {
    Logger.LogLevels = 0
  })

  afterEach(() => {
    engine?.dispose()
  })

  it('initializes engine with parameters', () => {
    const longTapDelay = faker.number.int(999)
    engine = createEngine({
      makeEngine: () => new NullEngine(),
      canvas,
      interaction,
      hand,
      longTapDelay,
      translate
    })
    expect(engine.enableOfflineSupport).toBe(false)
    expect(engine.inputElement).toBeUndefined()
    expect(engine.managers.hand.enabled).toBe(false)
    expect(engine.managers.input.longTapDelay).toBe(longTapDelay)
    expect(engine.managers.input.interaction).toBe(interaction)
    expect(engine.actionNamesByButton).toEqual(new Map([]))
    expect(engine.actionNamesByKey).toEqual(new Map([]))
  })

  describe.each([
    { title: 'real engine', canvas, makeEngine: () => new NullEngine() },
    { title: 'simulation engine' }
  ])('given a $title', ({ canvas, makeEngine }) => {
    /** @type {?import('@babylonjs/core').Observer<?>} */
    let loadingObserver
    const colorByPlayerId = new Map([[playerId, '#f0f']])
    const receiveLoading = vi.fn()

    beforeEach(() => {
      vi.clearAllMocks()
      engine = createEngine({
        makeEngine,
        canvas,
        interaction,
        hand,
        longTapDelay: 200,
        translate
      })
      loadingObserver = engine.onLoadingObservable.add(receiveLoading)
    })

    afterEach(() => {
      engine.onLoadingObservable.remove(loadingObserver)
    })

    it('enables material managers and lights according to its nature', () => {
      const isSimulation = !canvas
      expect(engine.managers.material.disabled).toBe(isSimulation)
      const ambientLight = engine.scenes[0].getLightByName('ambient')
      const sunLight = engine.scenes[1].getLightByName('sun')
      if (isSimulation) {
        expect(engine.simulation).toBeNull()
        expect(ambientLight).toBeNull()
        expect(sunLight).toBeNull()
      } else {
        expect(engine.simulation).toBeInstanceOf(NullEngine)
        expect(ambientLight).toBeDefined()
        expect(sunLight).toBeDefined()
      }
    })

    it('can load() game data, including colors and peers selections', async () => {
      const selections = [
        { playerId: peerId2, selectedIds: ['4'] },
        { playerId, selectedIds: ['1', '2'] },
        { playerId: peerId1, selectedIds: ['3'] }
      ]
      /** @type {import('@tabulous/types').Mesh} */
      const mesh = {
        shape: 'card',
        depth: 0.2,
        height: 4,
        id: 'card2',
        texture: 'https://elyse.biz',
        width: 3,
        x: -5,
        y: 0,
        z: -10
      }
      const applySelection = vi.spyOn(engine.managers.selection, 'apply')
      await engine.load(
        { id: '', created: Date.now(), meshes: [mesh], hands: [], selections },
        { playerId, colorByPlayerId, preference: { playerId } },
        false
      )
      engine.scenes[1].onDataLoadedObservable.notifyObservers(engine.scenes[1])
      expect(engine.scenes[1].getMeshById(mesh.id)).toBeDefined()
      expect(engine.isLoading).toBe(false)
      expect(engine.managers.input.enabled).toBe(Boolean(canvas))
      expect(engine.managers.selection.color).toEqual(
        Color4.FromHexString(
          /** @type {string} */ (colorByPlayerId.get(playerId))
        )
      )
      expect(receiveLoading).not.toHaveBeenCalled()
      expect(applySelection).toHaveBeenNthCalledWith(
        1,
        selections[0].selectedIds,
        peerId2
      )
      expect(applySelection).toHaveBeenNthCalledWith(
        2,
        selections[2].selectedIds,
        peerId1
      )
      expect(applySelection).toHaveBeenCalledTimes(2)
    })

    it('can serialize() game data', async () => {
      const id = 'card3'
      const texture = 'https://elyse.biz'
      await engine.load(
        {
          id: '',
          created: Date.now(),
          meshes: [{ id, texture, shape: 'card' }],
          hands: []
        },
        { playerId, colorByPlayerId, preference: { playerId } },
        false
      )
      expect(engine.serialize()).toEqual({
        meshes: [
          {
            shape: 'card',
            depth: 4.25,
            height: 0.01,
            id: 'card3',
            texture,
            faceUV: [
              [0.5, 1, 0, 0],
              [0.5, 0, 1, 1]
            ],
            width: 3,
            x: 0,
            y: 0,
            z: 0
          }
        ],
        handMeshes: [],
        history: []
      })
    })

    it('updates isLoading on initial load only', async () => {
      const selections = [
        { playerId: peerId2, selectedIds: ['4'] },
        { playerId, selectedIds: ['1', '2'] },
        { playerId: peerId1, selectedIds: ['3'] }
      ]
      /** @type {import('@tabulous/types').Mesh} */
      const mesh = {
        shape: 'card',
        depth: 0.2,
        height: 4,
        id: 'card2',
        texture: 'https://elyse.biz',
        width: 3,
        x: -5,
        y: 0,
        z: -10
      }
      expect(engine.isLoading).toBe(false)
      const applySelection = vi.spyOn(engine.managers.selection, 'apply')
      await engine.load(
        { id: '', created: Date.now(), meshes: [mesh], hands: [], selections },
        { playerId, colorByPlayerId, preference: { playerId } },
        true
      )
      expect(engine.isLoading).toBe(true)
      expect(receiveLoading).toHaveBeenCalledWith(true, expect.anything())
      expect(receiveLoading).toHaveBeenCalledTimes(1)
      receiveLoading.mockClear()
      engine.scenes[1].onDataLoadedObservable.notifyObservers(engine.scenes[1])
      await sleep(150)
      expect(engine.isLoading).toBe(false)
      expect(engine.scenes[1].getMeshById(mesh.id)).toBeDefined()
      expect(engine.managers.hand.enabled).toBe(false)
      expect(receiveLoading).toHaveBeenCalledWith(false, expect.anything())
      expect(receiveLoading).toHaveBeenCalledTimes(1)
      expect(applySelection).toHaveBeenNthCalledWith(
        1,
        selections[0].selectedIds,
        peerId2
      )
      expect(applySelection).toHaveBeenNthCalledWith(
        2,
        selections[2].selectedIds,
        peerId1
      )
      expect(applySelection).toHaveBeenCalledTimes(2)
    })

    it('enables hand manager on initial load', async () => {
      const angleOnPlay = faker.number.int(1) * Math.PI
      expect(engine.isLoading).toBe(false)
      await engine.load(
        {
          id: '',
          created: Date.now(),
          meshes: [],
          hands: [
            { playerId, meshes: [{ id: 'box', shape: 'card', texture: '' }] }
          ]
        },
        {
          playerId,
          colorByPlayerId,
          preference: { playerId, angle: angleOnPlay }
        },
        true
      )
      expect(engine.isLoading).toBe(true)
      engine.scenes[1].onDataLoadedObservable.notifyObservers(engine.scenes[1])
      expect(engine.isLoading).toBe(false)
      expect(engine.managers.hand.enabled).toBe(true)
      expect(engine.managers.hand.angleOnPlay).toBe(angleOnPlay)
      expect(engine.managers.hand.playerId).toBe(playerId)
    })

    it('invokes observer before disposing', () => {
      /** @type {string[]} */
      const ordering = []
      const handleBeforeDispose = vi
        .fn()
        .mockImplementation(() => ordering.push('beforeDispose'))
      const handleDispose = vi
        .fn()
        .mockImplementation(() => ordering.push('dispose'))
      engine.onBeforeDisposeObservable.addOnce(handleBeforeDispose)
      engine.onDisposeObservable.addOnce(handleDispose)
      engine.dispose()
      expect(handleBeforeDispose).toHaveBeenCalledTimes(1)
      expect(handleDispose).toHaveBeenCalledTimes(1)
      expect(ordering).toEqual(['beforeDispose', 'dispose'])
    })

    it('can load game specific actions', async () => {
      await engine.load(
        {
          id: '',
          created: Date.now(),
          meshes: [],
          hands: [],
          actions: { button1: ['rotate', 'pop'], button2: ['random'] }
        },
        { playerId, colorByPlayerId, preference: { playerId } },
        true
      )

      expect(engine.actionNamesByButton).toEqual(
        new Map([
          ['button1', ['rotate', 'pop']],
          ['button2', ['random']]
        ])
      )
    })

    it('configures rule engine on initial load', async () => {
      const engineScript = `"use strict";var engine={computeScore:()=>({'${playerId}':{total:10}})}`
      const players = [
        { id: playerId, username: 'Jane', currentGameId: '' },
        { id: peerId1, username: 'John', isOwner: true, currentGameId: '' },
        { id: peerId2, username: 'Jack', isGuest: true, currentGameId: '' }
      ]
      const preferences = [
        { playerId, color: 'red' },
        { playerId: peerId1, color: 'blue' }
      ]
      await engine.load(
        {
          id: '',
          created: Date.now(),
          meshes: [],
          hands: [],
          selections: [],
          players,
          preferences,
          engineScript
        },
        { playerId, colorByPlayerId, preference: { playerId } },
        true
      )
      expect(receiveLoading).toHaveBeenCalledWith(true, expect.anything())
      if (canvas) {
        expect(engine.managers.rule.ruleEngine).not.toBeNull()
        expect(
          engine.managers.rule.ruleEngine?.computeScore(
            null,
            { meshes: [], handMeshes: [], history: [] },
            [],
            []
          )
        ).toEqual({ [playerId]: { total: 10 } })
      } else {
        expect(engine.managers.rule.ruleEngine).toBeNull()
      }
      expect(engine.managers.rule.players).toEqual(players.slice(0, 2))
      expect(engine.managers.rule.preferences).toEqual(preferences)
    })

    describe('given some loaded meshes', () => {
      const duration = 200
      /** @type {import('@babylonjs/core').Engine} */
      let simulation
      /** @type {import('vitest').Spy<import('@src/3d/managers').ControlManager['apply']>} */
      let apply
      /** @type {import('vitest').Spy<import('@src/3d/managers').SelectionManager['apply']>} */
      let applySelection
      /** @type {import('vitest').Spy<import('@src/3d/managers').ReplayManager['record']>} */
      let record
      /** @type {import('vitest').Spy<import('@src/3d/managers').ControlManager['apply']>} */
      let simulationApply
      /** @type {import('vitest').Spy<import('@src/3d/managers').SelectionManager['apply']>} */
      let simulationApplySelection
      /** @type {import('vitest').Spy<import('@src/3d/managers').ReplayManager['record']>} */
      let simulationRecord

      beforeEach(async () => {
        await engine.load(
          {
            id: '',
            created: Date.now(),
            meshes: [
              {
                id: 'card1',
                shape: 'card',
                texture: '',
                drawable: { duration }
              },
              {
                id: 'card2',
                shape: 'card',
                texture: '',
                drawable: { duration },
                stackable: {},
                quantifiable: {}
              },
              {
                id: 'card3',
                shape: 'card',
                texture: '',
                drawable: { duration },
                flippable: {}
              }
            ],
            hands: []
          },
          { playerId, colorByPlayerId, preference: { playerId } },
          true
        )
        engine.start()
        record = vi.spyOn(engine.managers.replay, 'record')
        apply = vi.spyOn(engine.managers.control, 'apply')
        applySelection = vi.spyOn(engine.managers.selection, 'apply')
        if (engine.simulation) {
          simulation = engine.simulation
          simulationApply = vi.spyOn(simulation.managers.control, 'apply')
          simulationRecord = vi.spyOn(simulation.managers.replay, 'record')
          simulationApplySelection = vi.spyOn(
            simulation.managers.selection,
            'apply'
          )
        }
      })

      it('removes drawn mesh from main scene', async () => {
        const [, scene] = engine.scenes
        const drawn = /** @type {import('@babylonjs/core').Mesh} */ (
          scene.getMeshById('card2')
        )
        drawn.metadata.draw?.()
        await expectAnimationEnd(drawn.getBehaviorByName(DrawBehaviorName))
        expect(scene.getMeshById(drawn.id)).toBeNull()
        const game = engine.serialize()
        expect(getIds(game.meshes)).toEqual(['card1', 'card3'])
        expect(getIds(game.handMeshes)).toEqual(['card2'])
      })

      it('updates colors, players and preferences on subsequent loads', async () => {
        const newColor = '#123456'
        const newPlayerId = faker.string.uuid()
        const updatedColorByPlayerId = new Map([
          ...colorByPlayerId.entries(),
          [newPlayerId, newColor]
        ])
        const players = [
          { id: playerId, username: 'Jane', currentGameId: '' },
          { id: peerId1, username: 'John', isOwner: true, currentGameId: '' },
          { id: peerId2, username: 'Jack', isGuest: true, currentGameId: '' }
        ]
        const preferences = [{ playerId, color: 'red' }]
        await engine.load(
          {
            id: '',
            created: Date.now(),
            ...engine.serialize(),
            players,
            preferences,
            hands: []
          },
          {
            playerId,
            colorByPlayerId: updatedColorByPlayerId,
            preference: preferences[0]
          }
        )
        expect(
          engine.managers.selection.colorByPlayerId.get(newPlayerId)
        ).toEqual(Color4.FromHexString(newColor))
        expect(engine.managers.rule.players).toEqual(players.slice(0, 2))
        expect(engine.managers.rule.preferences).toEqual(preferences)
      })

      it('has action names mapped by button and shortcut', () => {
        expect(engine.actionNamesByButton).toEqual(
          new Map([
            ['button1', ['flip', 'random']],
            ['button2', ['rotate']]
          ])
        )
        expect(engine.actionNamesByKey).toEqual(
          new Map([
            ['shortcuts.drawOrPlay', ['draw', 'play']],
            ['shortcuts.reorder', ['reorder']],
            ['shortcuts.flip', ['flip']],
            ['shortcuts.push', ['push', 'increment']],
            ['shortcuts.pop', ['pop', 'decrement']]
          ])
        )
      })

      it('applies remote action', async () => {
        /** @type {import('@tabulous/types').Action} */
        const action = {
          fn: 'flip',
          meshId: 'card3',
          fromHand: false,
          args: []
        }
        await engine.applyRemoteAction(action, peerId2)
        expect(record).toHaveBeenNthCalledWith(1, action, peerId2)
        expect(record).toHaveBeenNthCalledWith(2, {
          ...action,
          isLocal: true,
          duration: 500
        })
        expect(record).toHaveBeenCalledTimes(2)
        expect(apply).toHaveBeenCalledWith(action)
        expect(apply).toHaveBeenCalledOnce()
        expect(record).toHaveBeenCalledBefore(apply)
      })

      it('applies remote selection', () => {
        const meshIds = ['box3']
        engine.applyRemoteSelection(meshIds, peerId2)
        expect(applySelection).toHaveBeenCalledWith(meshIds, peerId2)
        expect(applySelection).toHaveBeenCalledOnce()
      })

      describe('given replaying', () => {
        beforeEach(() => {
          vi.spyOn(
            engine.managers.replay,
            'isReplaying',
            'get'
          ).mockReturnValue(true)
        })

        it('does not apply remote action', async () => {
          /** @type {import('@tabulous/types').Action} */
          const action = {
            fn: 'flip',
            meshId: 'card3',
            fromHand: false,
            args: []
          }
          await engine.applyRemoteAction(action, peerId2)
          expect(record).toHaveBeenNthCalledWith(1, action, peerId2)
          expect(record).toHaveBeenCalledOnce()
          expect(apply).not.toHaveBeenCalled()
        })

        it('does not apply remote selection when replaying', async () => {
          engine.applyRemoteSelection(['box3'], peerId2)
          expect(applySelection).not.toHaveBeenCalled()
        })
      })

      if (canvas) {
        it('updates simulation on remote action', async () => {
          const state = engine.serialize()
          /** @type {import('@tabulous/types').Action} */
          const action = {
            fn: 'flip',
            meshId: 'card3',
            fromHand: false,
            args: []
          }
          await engine.applyRemoteAction(action, peerId2)
          expect(simulationRecord).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ isLocal: true })
          )
          expect(simulationRecord).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ isLocal: true })
          )
          expect(simulationRecord).toHaveBeenNthCalledWith(3, action, peerId2)
          expect(simulationRecord).toHaveBeenCalledTimes(3)
          expect(simulationApply).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ isLocal: true })
          )
          expect(simulationApply).toHaveBeenNthCalledWith(2, action)
          expect(simulationApply).toHaveBeenCalledTimes(2)
          expect(record).toHaveBeenNthCalledWith(1, action, peerId2)
          expect(record).toHaveBeenCalledTimes(2)
          expect(apply).toHaveBeenCalledWith(action)
          expect(apply).toHaveBeenCalledOnce()
          expect(engine.serialize()).toEqual({
            handMeshes: [],
            history: [
              {
                ...action,
                args: undefined,
                argsStr: '[]',
                playerId: peerId2,
                time: expect.any(Number)
              }
            ],
            meshes: [
              ...state.meshes.slice(0, 2),
              {
                ...state.meshes[2],
                flippable: { duration: 500, isFlipped: true },
                y: expect.numberCloseTo(0, 2)
              }
            ]
          })
        })

        it('updates simulation on local action', async () => {
          const state = engine.serialize()
          /** @type {import('@tabulous/types').Action} */
          const action = {
            fn: 'flip',
            meshId: 'card3',
            fromHand: false,
            duration: 500,
            isLocal: false,
            args: []
          }
          engine.scenes[1].getMeshById('card3')?.metadata.flip?.()
          expect(record).toHaveBeenCalledWith(action)
          expect(record).toHaveBeenCalledOnce()
          expect(apply).not.toHaveBeenCalled()
          expect(simulationRecord).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ isLocal: true })
          )
          expect(simulationRecord).toHaveBeenNthCalledWith(2, action)
          expect(simulationRecord).toHaveBeenCalledTimes(2)
          expect(simulationApply).toHaveBeenCalledWith(action)
          expect(simulationApply).toHaveBeenCalledOnce()
          expect(engine.serialize()).toEqual({
            handMeshes: [],
            history: [
              {
                ...action,
                isLocal: undefined,
                args: undefined,
                argsStr: '[]',
                playerId,
                time: expect.any(Number)
              }
            ],
            meshes: [
              ...state.meshes.slice(0, 2),
              {
                ...state.meshes[2],
                flippable: { duration: 500, isFlipped: true },
                y: expect.numberCloseTo(0, 2)
              }
            ]
          })
        })

        it('udpates simulation with remote selection', () => {
          const meshIds = ['box1', 'box3']
          engine.applyRemoteSelection(meshIds, peerId1)
          expect(simulationApplySelection).toHaveBeenCalledWith(
            meshIds,
            peerId1
          )
          expect(simulationApplySelection).toHaveBeenCalledOnce()
        })

        it('updates simulation with selected meshes', () => {
          const mesh = /** @type {import('@babylonjs/core').Mesh} */ (
            engine.scenes[1].getMeshById('card1')
          )
          engine.managers.selection.select(mesh)
          engine.managers.selection.unselect(mesh)
          expect(applySelection).not.toHaveBeenCalled()
          expect(simulationApplySelection).toHaveBeenNthCalledWith(
            1,
            ['card1'],
            playerId
          )
          expect(simulationApplySelection).toHaveBeenNthCalledWith(
            2,
            [],
            playerId
          )
          expect(simulationApplySelection).toHaveBeenCalledTimes(2)
        })

        it('updates simulation on load', async () => {
          expect(engine.scenes[1].getMeshById('card3')).toBeDefined()
          expect(simulation.scenes[1].getMeshById('card3')).toBeDefined()
          const state = engine.serialize()
          await engine.load(
            {
              id: '',
              created: Date.now(),
              meshes: [
                {
                  id: 'card1',
                  shape: 'card',
                  texture: '',
                  drawable: { duration }
                },
                {
                  id: 'card2',
                  shape: 'card',
                  texture: '',
                  drawable: { duration },
                  stackable: {},
                  quantifiable: {}
                }
              ],
              hands: []
            },
            { playerId, colorByPlayerId, preference: { playerId } }
          )
          expect(engine.scenes[1].getMeshById('card3')).toBeNull()
          expect(simulation.scenes[1].getMeshById('card3')).toBeNull()
          expect(engine.serialize()).toEqual({
            ...state,
            meshes: state.meshes.slice(0, -1)
          })
        })

        describe('given replaying', () => {
          beforeEach(() => {
            vi.spyOn(
              engine.managers.replay,
              'isReplaying',
              'get'
            ).mockReturnValue(true)
          })

          it('updates simulation on remote action', async () => {
            const state = engine.serialize()
            /** @type {import('@tabulous/types').Action} */
            const action = {
              fn: 'flip',
              meshId: 'card3',
              fromHand: false,
              args: []
            }
            await engine.applyRemoteAction(action, peerId2)
            expect(simulationRecord).toHaveBeenNthCalledWith(1, action, peerId2)
            expect(simulationRecord).toHaveBeenNthCalledWith(
              2,
              expect.objectContaining({ isLocal: true })
            )
            expect(simulationRecord).toHaveBeenCalledTimes(2)
            expect(simulationApply).toHaveBeenCalledWith(action)
            expect(simulationApply).toHaveBeenCalledOnce()
            expect(engine.serialize()).toEqual({
              handMeshes: [],
              history: [
                {
                  ...action,
                  args: undefined,
                  argsStr: '[]',
                  playerId: peerId2,
                  time: expect.any(Number)
                }
              ],
              meshes: [
                ...state.meshes.slice(0, 2),
                {
                  ...state.meshes[2],
                  flippable: { duration: 500, isFlipped: true },
                  y: expect.numberCloseTo(0, 2)
                }
              ]
            })
            expect(record).toHaveBeenCalledWith(action, peerId2)
            expect(record).toHaveBeenCalledOnce()
            expect(apply).not.toHaveBeenCalled()
          })

          it('does not update simulation on local action', async () => {
            const state = engine.serialize()
            engine.scenes[1].getMeshById('card3')?.metadata.flip?.()
            expect(record).toHaveBeenCalledWith({
              fn: 'flip',
              duration: 500,
              meshId: 'card3',
              fromHand: false,
              isLocal: false,
              args: []
            })
            expect(record).toHaveBeenCalledOnce()
            expect(apply).not.toHaveBeenCalled()
            expect(simulationRecord).not.toHaveBeenCalled()
            expect(simulationApply).not.toHaveBeenCalled()
            expect(engine.serialize()).toEqual(state)
          })

          it('updates simulation with remote selection', () => {
            const meshIds = ['box1', 'box3']
            engine.applyRemoteSelection(meshIds, peerId1)
            expect(simulationApplySelection).toHaveBeenCalledWith(
              meshIds,
              peerId1
            )
            expect(simulationApplySelection).toHaveBeenCalledOnce()
            expect(applySelection).not.toHaveBeenCalledOnce()
          })

          it('only loads simulation', async () => {
            expect(engine.scenes[1].getMeshById('card3')).toBeDefined()
            expect(simulation.scenes[1].getMeshById('card3')).toBeDefined()
            const state = engine.serialize()
            await engine.load(
              {
                id: '',
                created: Date.now(),
                meshes: [
                  {
                    id: 'card1',
                    shape: 'card',
                    texture: '',
                    drawable: { duration }
                  },
                  {
                    id: 'card2',
                    shape: 'card',
                    texture: '',
                    drawable: { duration },
                    stackable: {},
                    quantifiable: {}
                  }
                ],
                hands: []
              },
              { playerId, colorByPlayerId, preference: { playerId } }
            )
            expect(engine.scenes[1].getMeshById('card3')).toBeDefined()
            expect(simulation.scenes[1].getMeshById('card3')).toBeNull()
            expect(engine.serialize()).toEqual({
              ...state,
              meshes: state.meshes.slice(0, -1)
            })
          })
        })
      }
    })
  })
})

function getIds(
  /** @type {import('@tabulous/types').Mesh[]|undefined} */ meshes
) {
  return meshes?.map(({ id }) => id) ?? []
}
