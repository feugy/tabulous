import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Scene } from '@babylonjs/core/scene'
import { faker } from '@faker-js/faker'
import { createEngine } from '../../src/3d'
import { createCard } from '../../src/3d/meshes'
import { DrawBehaviorName } from '../../src/3d/behaviors'
import { expectAnimationEnd } from '../test-utils'
import { handManager } from '../../src/3d/managers'

let engine
const playerId = faker.datatype.uuid()
const canvas = document.createElement('canvas')
const interaction = document.createElement('div')

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementationOnce(() => ({}))
})

afterEach(() => {
  engine?.dispose()
})

describe('createEngine()', () => {
  it('initializes engine with parameters', () => {
    const doubleTapDelay = faker.datatype.number()
    const longTapDelay = faker.datatype.number()
    engine = createEngine({
      Engine: NullEngine,
      canvas,
      interaction,
      doubleTapDelay,
      longTapDelay
    })
    expect(engine.enableOfflineSupport).toBe(false)
    expect(engine.inputElement).toEqual(interaction)
    expect(Scene.DoubleClickDelay).toEqual(doubleTapDelay)
    expect(handManager.enabled).toBe(false)
  })
  // TODO input manager stopAll()

  describe('given an engine', () => {
    let displayLoadingUI

    beforeEach(() => {
      engine = createEngine({
        Engine: NullEngine,
        canvas,
        interaction,
        doubleTapDelay: 100,
        longTapDelay: 200
      })
      displayLoadingUI = jest.spyOn(engine, 'displayLoadingUI')
    })

    it('can load() game data', async () => {
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
      await engine.load({ meshes: [mesh], hands: [] }, playerId, false)
      expect(engine.isLoading).toBe(false)
      engine.scenes[1].onDataLoadedObservable.notifyObservers()
      expect(engine.scenes[1].getMeshById(mesh.id)).toBeDefined()
      expect(displayLoadingUI).not.toHaveBeenCalled()
      expect(engine.isLoading).toBe(false)
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
      await engine.load({ meshes: [mesh], hands: [] }, playerId, true)
      expect(engine.isLoading).toBe(true)
      engine.scenes[1].onDataLoadedObservable.notifyObservers()
      expect(engine.isLoading).toBe(false)
      expect(engine.scenes[1].getMeshById(mesh.id)).toBeDefined()
      expect(displayLoadingUI).toHaveBeenCalledTimes(1)
      expect(handManager.enabled).toBe(false)
    })

    it('enables hand manager on initial load', async () => {
      expect(engine.isLoading).toBe(false)
      await engine.load(
        {
          meshes: [],
          hands: [{ playerId, meshes: [{ id: 'box', shape: 'card' }] }]
        },
        playerId,
        true
      )
      expect(engine.isLoading).toBe(true)
      engine.scenes[1].onDataLoadedObservable.notifyObservers()
      expect(engine.isLoading).toBe(false)
      expect(displayLoadingUI).toHaveBeenCalledTimes(1)
      expect(handManager.enabled).toBe(true)
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
          true
        )
        engine.start()
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
    })
  })
})

function getIds(meshes) {
  return meshes?.map(({ id }) => id) ?? []
}
