import faker from 'faker'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Scene } from '@babylonjs/core/scene'
import { createEngine } from '../../src/3d'
import { createCard } from '../../src/3d/meshes'
import { DrawBehaviorName } from '../../src/3d/behaviors'
import { expectAnimationEnd } from '../test-utils'
import { handManager } from '../../src/3d/managers'

let engine
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

    it('can load() game data', () => {
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
      engine.load({ meshes: [mesh], handMeshes: [] }, false)
      expect(engine.scenes[1].getMeshById(mesh.id)).toBeDefined()
      expect(displayLoadingUI).not.toHaveBeenCalled()
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
              [0.5, 1, 1, 0]
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

    it('displays loading UI on initial load only', () => {
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
      engine.load({ meshes: [mesh], handMeshes: [] }, true)
      expect(engine.scenes[1].getMeshById(mesh.id)).toBeDefined()
      expect(displayLoadingUI).toHaveBeenCalledTimes(1)
      expect(handManager.enabled).toBe(false)
    })

    it('enables hand manager on initial load', () => {
      engine.load(
        { meshes: [], handMeshes: [{ id: 'box', shape: 'card' }] },
        true
      )
      expect(displayLoadingUI).toHaveBeenCalledTimes(1)
      expect(handManager.enabled).toBe(true)
    })

    describe('given some loaded meshes', () => {
      beforeEach(() => {
        const duration = 200
        engine.load(
          {
            meshes: [
              { id: 'card1', shape: 'card', drawable: { duration } },
              { id: 'card2', shape: 'card', drawable: { duration } },
              { id: 'card3', shape: 'card', drawable: { duration } }
            ],
            handMeshes: []
          },
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
