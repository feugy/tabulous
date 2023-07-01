import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Logger } from '@babylonjs/core/Misc/logger'
import { faker } from '@faker-js/faker'
import { createEngine } from '@src/3d'
import { DrawBehaviorName } from '@src/3d/behaviors'
import {
  handManager,
  inputManager,
  selectionManager,
  targetManager
} from '@src/3d/managers'
import { createCard } from '@src/3d/meshes'
import { sleep } from '@src/utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { expectAnimationEnd } from '../test-utils'

describe('createEngine()', () => {
  let engine
  const playerId = faker.string.uuid()
  const peerId1 = faker.string.uuid()
  const peerId2 = faker.string.uuid()
  const canvas = document.createElement('canvas')
  const interaction = document.createElement('div')
  const hand = document.createElement('div')
  const inputInit = vi.spyOn(inputManager, 'init')
  const updateColors = vi.spyOn(selectionManager, 'updateColors')
  const applySelection = vi.spyOn(selectionManager, 'apply')
  const targetInit = vi.spyOn(targetManager, 'init')
  const handInit = vi.spyOn(handManager, 'init')
  const translate = key => key

  beforeEach(() => {
    Logger.LogLevels = 0
  })

  afterEach(() => {
    engine?.dispose()
  })

  it('initializes engine with parameters', () => {
    const doubleTapDelay = faker.number.int(999)
    const longTapDelay = faker.number.int(999)
    engine = createEngine({
      Engine: NullEngine,
      canvas,
      interaction,
      hand,
      doubleTapDelay,
      longTapDelay,
      translate
    })
    expect(engine.enableOfflineSupport).toBe(false)
    expect(engine.inputElement).toBeUndefined()
    expect(handManager.enabled).toBe(false)
    expect(inputInit).toHaveBeenCalledWith(
      expect.objectContaining({
        doubleTapDelay,
        longTapDelay,
        interaction
      })
    )
    expect(inputInit).toHaveBeenCalledTimes(1)
    expect(targetInit).not.toHaveBeenCalled()
    expect(handInit).not.toHaveBeenCalled()
    expect(updateColors).not.toHaveBeenCalled()
    expect(applySelection).not.toHaveBeenCalled()
    expect(engine.actionNamesByButton).toEqual(new Map([]))
    expect(engine.actionNamesByKey).toEqual(new Map([]))
  })
  // TODO input manager stopAll()

  describe('given an engine', () => {
    let displayLoadingUI
    let loadingObserver
    const colorByPlayerId = new Map([[playerId, '#f0f']])
    const receiveLoading = vi.fn()

    beforeEach(() => {
      vi.clearAllMocks()
      engine = createEngine({
        Engine: NullEngine,
        canvas,
        interaction,
        hand,
        doubleTapDelay: 100,
        longTapDelay: 200,
        translate
      })
      loadingObserver = engine.onLoadingObservable.add(receiveLoading)
      displayLoadingUI = vi.spyOn(engine, 'displayLoadingUI')
    })

    afterEach(() => engine.onLoadingObservable.remove(loadingObserver))

    it('can load() game data, including colors and peers selections', async () => {
      applySelection.mockResolvedValue()
      const selections = [
        { playerId: peerId2, selectedIds: ['4'] },
        { playerId, selectedIds: ['1', '2'] },
        { playerId: peerId1, selectedIds: ['3'] }
      ]
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
      await engine.load(
        { meshes: [mesh], hands: [], selections },
        { playerId, colorByPlayerId, preferences: {} },
        false
      )
      engine.scenes[1].onDataLoadedObservable.notifyObservers()
      expect(engine.scenes[1].getMeshById(mesh.id)).toBeDefined()
      expect(displayLoadingUI).not.toHaveBeenCalled()
      expect(engine.isLoading).toBe(false)
      expect(updateColors).toHaveBeenCalledWith(playerId, colorByPlayerId)
      expect(updateColors).toHaveBeenCalledTimes(1)
      expect(receiveLoading).not.toHaveBeenCalled()
      expect(targetInit).not.toHaveBeenCalled()
      expect(handInit).not.toHaveBeenCalled()
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

    it('can serialize() game data', () => {
      createCard(
        { id: 'card3', texture: 'https://elyse.biz' },
        engine.scenes[1]
      )
      expect(engine.serialize()).toEqual({
        meshes: [
          {
            shape: 'card',
            depth: 4.25,
            height: 0.01,
            id: 'card3',
            texture: 'https://elyse.biz',
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
        handMeshes: []
      })
    })

    it('displays loading UI on initial load only', async () => {
      const selections = [
        { playerId: peerId2, selectedIds: ['4'] },
        { playerId, selectedIds: ['1', '2'] },
        { playerId: peerId1, selectedIds: ['3'] }
      ]
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
      await engine.load(
        { meshes: [mesh], hands: [], selections },
        { playerId, colorByPlayerId },
        true
      )
      expect(engine.isLoading).toBe(true)
      expect(receiveLoading).toHaveBeenCalledWith(true, expect.anything())
      expect(receiveLoading).toHaveBeenCalledTimes(1)
      receiveLoading.mockClear()
      engine.scenes[1].onDataLoadedObservable.notifyObservers()
      await sleep(150)
      expect(engine.isLoading).toBe(false)
      expect(engine.scenes[1].getMeshById(mesh.id)).toBeDefined()
      expect(displayLoadingUI).toHaveBeenCalledTimes(1)
      expect(handManager.enabled).toBe(false)
      expect(receiveLoading).toHaveBeenCalledWith(false, expect.anything())
      expect(receiveLoading).toHaveBeenCalledTimes(1)
      expect(targetInit).toHaveBeenCalledWith(
        expect.objectContaining({
          color: colorByPlayerId.get(playerId)
        })
      )
      expect(targetInit).toHaveBeenCalledTimes(1)
      expect(handInit).not.toHaveBeenCalled()
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
          meshes: [],
          hands: [{ playerId, meshes: [{ id: 'box', shape: 'card' }] }]
        },
        { playerId, colorByPlayerId, preferences: { angle: angleOnPlay } },
        true
      )
      expect(engine.isLoading).toBe(true)
      engine.scenes[1].onDataLoadedObservable.notifyObservers()
      expect(engine.isLoading).toBe(false)
      expect(displayLoadingUI).toHaveBeenCalledTimes(1)
      expect(handManager.enabled).toBe(true)
      expect(handInit).toHaveBeenCalledWith({
        scene: engine.scenes[1],
        handScene: engine.scenes[0],
        overlay: expect.anything(),
        angleOnPlay
      })
      expect(handInit).toHaveBeenCalledTimes(1)
    })

    it('invokes observer before disposing', () => {
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
          meshes: [],
          hands: [],
          actions: { button1: ['rotate', 'pop'], button3: ['random'] }
        },
        { playerId, colorByPlayerId, preferences: {} },
        true
      )

      expect(engine.actionNamesByButton).toMatchInlineSnapshot(`
        Map {
          "button1" => [
            "rotate",
            "pop",
          ],
          "button3" => [
            "random",
          ],
        }
      `)
    })

    describe('given some loaded meshes', () => {
      beforeEach(async () => {
        const duration = 200
        await engine.load(
          {
            meshes: [
              { id: 'card1', shape: 'card', drawable: { duration } },
              { id: 'card2', shape: 'card', drawable: { duration } },
              { id: 'card3', shape: 'card', drawable: { duration } }
            ],
            hands: []
          },
          { playerId, colorByPlayerId, preferences: {} },
          true
        )
        engine.start()
        updateColors.mockReset()
      })

      it('removes drawn mesh from main scene', async () => {
        const [, scene] = engine.scenes
        const drawn = scene.getMeshById('card2')
        drawn.metadata.draw()
        await expectAnimationEnd(drawn.getBehaviorByName(DrawBehaviorName))
        expect(scene.getMeshById(drawn.id)).toBeNull()
        const game = engine.serialize()
        expect(getIds(game.meshes)).toEqual(['card1', 'card3'])
        expect(getIds(game.handMeshes)).toEqual(['card2'])
      })

      it('updates color on subsequent loads', async () => {
        const updatedColorByPlayerId = new Map([
          ...colorByPlayerId.entries(),
          [faker.string.uuid(), '#123456']
        ])
        await engine.load(
          { ...engine.serialize(), hands: [] },
          { playerId, colorByPlayerId: updatedColorByPlayerId, preferences: {} }
        )
        expect(updateColors).toHaveBeenCalledWith(
          playerId,
          updatedColorByPlayerId
        )
        expect(updateColors).toHaveBeenCalledTimes(1)
      })

      it('has default actionIds map by button and key', () => {
        expect(engine.actionNamesByButton).toMatchInlineSnapshot(`
          Map {
            "button1" => [
              "flip",
              "random",
            ],
            "button2" => [
              "rotate",
            ],
            "button3" => [
              "detail",
            ],
          }
        `)
        expect(engine.actionNamesByKey).toMatchInlineSnapshot(`
          Map {
            "shortcuts.flip" => [
              "flip",
            ],
            "shortcuts.rotate" => [
              "rotate",
            ],
            "shortcuts.toggleLock" => [
              "toggleLock",
            ],
            "shortcuts.draw" => [
              "draw",
            ],
            "shortcuts.shuffle" => [
              "reorder",
            ],
            "shortcuts.push" => [
              "push",
              "increment",
            ],
            "shortcuts.pop" => [
              "pop",
              "decrement",
            ],
            "shortcuts.random" => [
              "random",
            ],
            "shortcuts.set-face" => [
              "setFace",
            ],
            "shortcuts.detail" => [
              "detail",
            ],
          }
        `)
      })
    })
  })
})

function getIds(meshes) {
  return meshes?.map(({ id }) => id) ?? []
}
