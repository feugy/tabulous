import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import {
  createCard,
  createTable,
  createRoundToken,
  createRoundedTile
} from '../../../src/3d'
import { MoveBehaviorName, StackBehaviorName } from '../../../src/3d/behaviors'
import { loadMeshes, serializeMeshes } from '../../../src/3d/utils/scene-loader'
import { initialize3dEngine } from '../../test-utils'

let engine
let scene
const renderWidth = 2048
const renderHeight = 1024

afterAll(() => engine.dispose())

describe('serializeMeshes() 3D utility', () => {
  it('ignores engine without scene', () => {
    jest.spyOn(console, 'log').mockImplementationOnce(() => {})
    engine = new NullEngine()
    expect(serializeMeshes(engine)).toBeUndefined()
  })

  describe('given an engine', () => {
    beforeAll(() => {
      ;({ engine, scene } = initialize3dEngine({ renderWidth, renderHeight }))
    })

    beforeEach(() => {
      for (const mesh of [...scene.meshes]) {
        mesh.dispose()
      }
    })

    it('can handle an empty scene', () => {
      expect(serializeMeshes(engine)).toEqual([])
    })

    it('serializes cards', () => {
      const card1 = createCard({ id: 'card1' })
      const card2 = createCard({
        id: 'card2',
        texture: faker.internet.url(),
        images: [faker.random.word()],
        x: faker.datatype.number(),
        y: faker.datatype.number(),
        z: faker.datatype.number(),
        width: faker.datatype.number(),
        height: faker.datatype.number(),
        depth: faker.datatype.number()
      })
      expect(serializeMeshes(engine)).toEqual([
        card1.metadata.serialize(),
        card2.metadata.serialize()
      ])
    })

    it('serializes round tokens', () => {
      const token1 = createRoundToken({ id: 'token1' })
      const token2 = createRoundToken({
        id: 'token2',
        texture: faker.internet.url(),
        images: [faker.random.word()],
        x: faker.datatype.number(),
        y: faker.datatype.number(),
        z: faker.datatype.number(),
        diameter: faker.datatype.number(),
        height: faker.datatype.number()
      })
      expect(serializeMeshes(engine)).toEqual([
        token1.metadata.serialize(),
        token2.metadata.serialize()
      ])
    })

    it('serializes rounded tiles', () => {
      const tile1 = createRoundedTile({ id: 'tile1' })
      const tile2 = createRoundedTile({
        id: 'tile2',
        texture: faker.internet.url(),
        images: [faker.random.word()],
        x: faker.datatype.number(),
        y: faker.datatype.number(),
        z: faker.datatype.number(),
        borderRadius: faker.datatype.number(),
        faceUV: [Array.from({ length: 4 }, () => faker.datatype.number())],
        width: faker.datatype.number(),
        height: faker.datatype.number(),
        depth: faker.datatype.number()
      })
      expect(serializeMeshes(engine)).toEqual([
        tile1.metadata.serialize(),
        tile2.metadata.serialize()
      ])
    })
  })
})

describe('loadMeshes() 3D utility', () => {
  it('ignores engine without scene', () => {
    jest.spyOn(console, 'log').mockImplementationOnce(() => {})
    engine = new NullEngine()
    expect(loadMeshes(engine, [])).toBeUndefined()
  })

  describe('given an engine and some data', () => {
    let card1 = {
      shape: 'card',
      depth: 0.13,
      height: 4.2,
      id: 'card1',
      texture: 'https://elyse.biz',
      faceUV: [
        [0.5, 1, 0, 0],
        [0.5, 1, 1, 0]
      ],
      width: 7.8,
      x: 21,
      y: 62,
      z: 52,
      detailable: { frontImage: 'foo.png', backImage: 'bar.webp' },
      movable: { snapDistance: 0.1, duration: 100 },
      anchorable: { anchors: [], duration: 100 },
      flippable: { isFlipped: true, duration: 200 },
      rotable: { angle: Math.PI, duration: 250 }
    }

    let card2 = {
      shape: 'card',
      depth: 0.2,
      height: 4,
      id: 'card2',
      texture: 'https://elyse.biz',
      faceUV: [
        [0.5, 1, 0, 0],
        [0.5, 1, 1, 0]
      ],
      width: 3,
      x: -5,
      y: 0,
      z: -10
    }

    let token1 = {
      shape: 'roundToken',
      diameter: 5.1,
      height: 7.6,
      id: 'token1',
      texture: 'https://miracle.com',
      faceUV: [
        [0, 0, 0.5, 1],
        [0, 0, 0, 0],
        [0.5, 0, 1, 1]
      ],
      x: 78,
      y: 34,
      z: 63,
      flippable: { isFlipped: true, duration: 200 },
      rotable: { angle: Math.PI, duration: 250 }
    }

    let tile1 = {
      shape: 'roundedTile',
      borderRadius: 1.14,
      depth: 3.44,
      height: 5.67,
      id: 'tile1',
      texture: 'https://rusty.net',
      faceUV: [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0.5, 1, 0, 0],
        [0.5, 0, 1, 1]
      ],
      width: 5,
      x: 43,
      y: 37,
      z: 72
    }

    beforeAll(() => {
      ;({ engine, scene } = initialize3dEngine({ renderWidth, renderHeight }))
    })

    beforeEach(() => {
      for (const mesh of [...scene.meshes]) {
        mesh.dispose()
      }
    })

    it('handles empty input', () => {
      expect(loadMeshes(engine, [])).toBeUndefined()
    })

    it('displays loading UI on initial load only', () => {
      const displayLoadingUI = jest.spyOn(engine, 'displayLoadingUI')

      loadMeshes(engine, [card1], false)
      expect(displayLoadingUI).toHaveBeenCalledTimes(0)
      expect(scene.getMeshById(card1.id)).toBeDefined()

      loadMeshes(engine, [card1])
      expect(displayLoadingUI).toHaveBeenCalledTimes(1)
      expect(scene.getMeshById(card1.id)).toBeDefined()
    })

    it('disposes all existing cards, tokens, tiles and boxes but leaves other meshes', () => {
      createTable()
      createRoundToken({ id: 'token' })
      CreateBox('box', { width: 10, height: 10, depth: 10 })
      createRoundedTile({ id: 'tile' })
      createCard({ id: 'card' })

      expect(scene.getMeshById('table')).toBeDefined()
      expect(scene.getMeshById('token')).toBeDefined()
      expect(scene.getMeshById('box')).toBeDefined()
      expect(scene.getMeshById('tile')).toBeDefined()
      expect(scene.getMeshById('card')).toBeDefined()

      loadMeshes(engine, [])

      expect(scene.getMeshById('table')).toBeDefined()
      expect(scene.getMeshById('token')).toBeNull()
      expect(scene.getMeshById('box')).toBeDefined()
      expect(scene.getMeshById('tile')).toBeNull()
      expect(scene.getMeshById('card')).toBeNull()
    })

    it('adds new meshes with their behaviors', () => {
      loadMeshes(engine, [card1, token1, tile1, card2])
      expect(scene.getMeshById(card1.id)).toBeDefined()
      expect(scene.getMeshById(card1.id).metadata.serialize()).toEqual(card1)
      expect(scene.getMeshById(card2.id)).toBeDefined()
      expect(scene.getMeshById(card2.id).metadata.serialize()).toEqual(card2)
      expect(scene.getMeshById(token1.id)).toBeDefined()
      expect(scene.getMeshById(token1.id).metadata.serialize()).toEqual(token1)
      expect(scene.getMeshById(tile1.id)).toBeDefined()
      expect(scene.getMeshById(tile1.id).metadata.serialize()).toEqual(tile1)
    })

    it('trims null values out', () => {
      const id = 'card20'
      const card = {
        shape: 'card',
        depth: 0.13,
        height: 4.2,
        id,
        images: ['mobile'],
        texture: 'https://elyse.biz',
        width: 7.8,
        x: 21,
        y: null,
        z: null,
        movable: { snapDistance: 0.1, duration: null },
        stackable: {}
      }
      loadMeshes(engine, [card])
      const mesh = scene.getMeshById(id)
      expect(mesh.absolutePosition.asArray()).toEqual([card.x, 0, 0])
      expect(mesh.getBehaviorByName(MoveBehaviorName).state).toEqual({
        snapDistance: card.movable.snapDistance,
        duration: 100
      })
      expect(mesh.getBehaviorByName(StackBehaviorName).state).toEqual({
        stackIds: [],
        duration: 100,
        extent: 0.3
      })
    })

    it('updates existing meshes with their behaviors', () => {
      const originalCard = createCard({
        id: card1.id,
        x: 21,
        y: 62,
        z: 52
      })
      const originalTile = createRoundedTile({
        id: tile1.id,
        x: -23,
        y: 0,
        z: -5.34
      })
      const originalToken = createRoundToken({
        id: token1.id,
        x: 10,
        y: 20,
        z: 30,
        flippable: { isFlipped: false },
        rotable: { angle: Math.PI * 2 }
      })
      loadMeshes(engine, [card1, card2, token1, tile1])
      expect(scene.getMeshById(card1.id)).toBeDefined()
      expect(scene.getMeshById(card1.id).metadata.serialize()).toEqual({
        ...originalCard.metadata.serialize(),
        x: card1.x,
        y: card1.y,
        z: card1.z
      })
      expect(scene.getMeshById(card2.id)).toBeDefined()
      expect(scene.getMeshById(card2.id).metadata.serialize()).toEqual(card2)
      expect(scene.getMeshById(token1.id)).toBeDefined()
      expect(scene.getMeshById(token1.id).metadata.serialize()).toEqual({
        ...originalToken.metadata.serialize(),
        x: token1.x,
        y: token1.y,
        z: token1.z,
        flippable: token1.flippable,
        rotable: token1.rotable
      })
      expect(scene.getMeshById(tile1.id)).toBeDefined()
      expect(scene.getMeshById(tile1.id).metadata.serialize()).toEqual({
        ...originalTile.metadata.serialize(),
        x: tile1.x,
        y: tile1.y,
        z: tile1.z
      })
    })

    it('restores mesh stacks', () => {
      let card1 = {
        shape: 'card',
        id: 'card1',
        stackable: {
          duration: 100,
          extent: 0.5,
          kinds: 'card',
          stackIds: ['card2', 'card4', 'card3']
        }
      }
      loadMeshes(engine, [
        card1,
        { shape: 'card', id: 'card2', stackable: { stackIds: [] } },
        { shape: 'card', id: 'card3' },
        { shape: 'card', id: 'card4' }
      ])
      expect(scene.getMeshById(card1.id)).toBeDefined()
      expect(scene.getMeshById(card1.id).metadata.serialize()).toEqual({
        ...card1,
        depth: 4.25,
        height: 0.01,
        width: 3,
        faceUV: [
          [0.5, 1, 0, 0],
          [0.5, 1, 1, 0]
        ],
        x: 0,
        y: 0,
        z: 0
      })
    })
  })
})
