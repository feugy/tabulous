import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Logger } from '@babylonjs/core/Misc/logger'
import { faker } from '@faker-js/faker'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEngine } from '../../src/3d'
import { DrawBehaviorName } from '../../src/3d/behaviors'
import {
  handManager,
  inputManager,
  selectionManager,
  targetManager
} from '../../src/3d/managers'
import { createCard } from '../../src/3d/meshes'
import { sleep } from '../../src/utils'
import { expectAnimationEnd } from '../test-utils'

describe('createEngine()', () => {
  let engine
  const playerId = faker.datatype.uuid()
  const peerId1 = faker.datatype.uuid()
  const peerId2 = faker.datatype.uuid()
  const canvas = document.createElement('canvas')
  const interaction = document.createElement('div')
  const hand = document.createElement('div')
  const inputInit = vi.spyOn(inputManager, 'init')
  const updateColors = vi.spyOn(selectionManager, 'updateColors')
  const applySelection = vi.spyOn(selectionManager, 'apply')
  const targetInit = vi.spyOn(targetManager, 'init')

  beforeEach(() => {
    Logger.LogLevels = 0
  })

  afterEach(() => {
    engine?.dispose()
  })

  it('initializes engine with parameters', () => {
    const doubleTapDelay = faker.datatype.number()
    const longTapDelay = faker.datatype.number()
    engine = createEngine({
      Engine: NullEngine,
      canvas,
      interaction,
      hand,
      doubleTapDelay,
      longTapDelay
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
    expect(updateColors).not.toHaveBeenCalled()
    expect(applySelection).not.toHaveBeenCalled()
  })
  // TODO input manager stopAll()

  describe('given an engine', () => {
    let displayLoadingUI
    let loadingObserver
    const colorByPlayerId = new Map([[playerId, '#f0f']])
    const receiveLoading = vi.fn()

    beforeEach(() => {
      vi.resetAllMocks()
      engine = createEngine({
        Engine: NullEngine,
        canvas,
        interaction,
        hand,
        doubleTapDelay: 100,
        longTapDelay: 200
      })
      loadingObserver = engine.onLoadingObservable.add(receiveLoading)
      displayLoadingUI = vi.spyOn(engine, 'displayLoadingUI')
    })

    afterEach(() => engine.onLoadingObservable.remove(loadingObserver))

    it('can load() game data, including colors and peers selections', async () => {
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
        playerId,
        colorByPlayerId,
        false
      )
      engine.scenes[1].onDataLoadedObservable.notifyObservers()
      expect(engine.scenes[1].getMeshById(mesh.id)).toBeDefined()
      expect(displayLoadingUI).not.toHaveBeenCalled()
      expect(engine.isLoading).toBe(false)
      expect(updateColors).toHaveBeenCalledWith(playerId, colorByPlayerId, 0.2)
      expect(updateColors).toHaveBeenCalledTimes(1)
      expect(receiveLoading).not.toHaveBeenCalled()
      expect(targetInit).not.toHaveBeenCalled()
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
        playerId,
        colorByPlayerId,
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
      expect(engine.isLoading).toBe(false)
      await engine.load(
        {
          meshes: [],
          hands: [{ playerId, meshes: [{ id: 'box', shape: 'card' }] }]
        },
        playerId,
        colorByPlayerId,
        true
      )
      expect(engine.isLoading).toBe(true)
      engine.scenes[1].onDataLoadedObservable.notifyObservers()
      expect(engine.isLoading).toBe(false)
      expect(displayLoadingUI).toHaveBeenCalledTimes(1)
      expect(handManager.enabled).toBe(true)
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
          playerId,
          colorByPlayerId,
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
          [faker.datatype.uuid(), '#123456']
        ])
        await engine.load(
          { ...engine.serialize(), hands: [] },
          playerId,
          updatedColorByPlayerId
        )
        expect(updateColors).toHaveBeenCalledWith(
          playerId,
          updatedColorByPlayerId,
          0.2
        )
        expect(updateColors).toHaveBeenCalledTimes(1)
      })
    })
  })
})

function getIds(meshes) {
  return meshes?.map(({ id }) => id) ?? []
}
