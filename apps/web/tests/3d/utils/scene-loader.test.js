import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import {
  createBoard,
  createCard,
  createTable,
  createRoundToken,
  createRoundedTile
} from '../../../src/3d'
import { loadScene, serializeScene } from '../../../src/3d/utils/scene-loader'
import { initialize3dEngine } from '../../test-utils'

let engine
let scene
const renderWidth = 2048
const renderHeight = 1024

afterAll(() => engine.dispose())

describe('serializeScene() 3D utility', () => {
  it('ignores engine without scene', () => {
    jest.spyOn(console, 'log').mockImplementationOnce(() => {})
    engine = new NullEngine()
    expect(serializeScene(engine)).toBeUndefined()
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
      expect(serializeScene(engine)).toEqual({
        cards: [],
        roundTokens: [],
        roundedTiles: [],
        boards: []
      })
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
      expect(serializeScene(engine)).toEqual({
        cards: [card1.metadata.serialize(), card2.metadata.serialize()],
        roundTokens: [],
        roundedTiles: [],
        boards: []
      })
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
      expect(serializeScene(engine)).toEqual({
        cards: [],
        roundTokens: [token1.metadata.serialize(), token2.metadata.serialize()],
        roundedTiles: [],
        boards: []
      })
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
        borderColor: [0, 10, 100, 50],
        width: faker.datatype.number(),
        height: faker.datatype.number(),
        depth: faker.datatype.number()
      })
      expect(serializeScene(engine)).toEqual({
        cards: [],
        roundTokens: [],
        roundedTiles: [tile1.metadata.serialize(), tile2.metadata.serialize()],
        boards: []
      })
    })

    it('serializes boards', () => {
      const board1 = createBoard({ id: 'board1' })
      const board2 = createBoard({
        id: 'board2',
        texture: faker.internet.url(),
        images: [faker.random.word()],
        x: faker.datatype.number(),
        y: faker.datatype.number(),
        z: faker.datatype.number(),
        borderRadius: faker.datatype.number(),
        width: faker.datatype.number(),
        height: faker.datatype.number(),
        depth: faker.datatype.number()
      })
      expect(serializeScene(engine)).toEqual({
        cards: [],
        roundTokens: [],
        roundedTiles: [],
        boards: [board1.metadata.serialize(), board2.metadata.serialize()]
      })
    })
  })
})

describe('loadScene() 3D utility', () => {
  it('ignores engine without scene', () => {
    jest.spyOn(console, 'log').mockImplementationOnce(() => {})
    engine = new NullEngine()
    expect(loadScene(engine, {})).toBeUndefined()
  })

  describe('given an engine and some data', () => {
    let card1 = {
      depth: 0.13,
      height: 4.2,
      id: 'card1',
      images: ['mobile'],
      texture: 'https://elyse.biz',
      width: 7.8,
      x: 21,
      y: 62,
      z: 52,
      detailable: true,
      movable: { snapDistance: 0.1, duration: 100 },
      anchorable: { anchors: [], duration: 100 },
      flippable: { isFlipped: true, duration: 200 },
      rotable: { angle: Math.PI, duration: 250 }
    }

    let card2 = {
      depth: 0.2,
      height: 4,
      id: 'card2',
      images: ['network'],
      texture: 'https://elyse.biz',
      width: 3,
      x: -5,
      y: 0,
      z: -10
    }

    let token1 = {
      diameter: 5.1,
      height: 7.6,
      id: 'token1',
      images: ['neural'],
      texture: 'https://miracle.com',
      x: 78,
      y: 34,
      z: 63,
      flippable: { isFlipped: true, duration: 200 },
      rotable: { angle: Math.PI, duration: 250 }
    }

    let tile1 = {
      borderColor: [0, 10, 100, 50],
      borderRadius: 1.14,
      depth: 3.44,
      height: 5.67,
      id: 'tile1',
      images: ['payment'],
      texture: 'https://rusty.net',
      width: 5,
      x: 43,
      y: 37,
      z: 72
    }

    let board1 = {
      borderRadius: 6.45,
      depth: 2.98,
      height: 4,
      id: 'board1',
      texture: 'https://raegan.biz',
      width: 3.9,
      x: 82,
      y: 24,
      z: 86,
      movable: { snapDistance: 0.1, duration: 100 },
      anchorable: { anchors: [], duration: 100 }
    }

    beforeAll(() => {
      ;({ engine, scene } = initialize3dEngine({ renderWidth, renderHeight }))
    })

    beforeEach(() => {
      for (const mesh of [...scene.meshes]) {
        mesh.dispose()
      }
    })

    it('handles empty or no data', () => {
      expect(loadScene(engine, {})).toBeUndefined()
      expect(scene.meshes).toHaveLength(0)
      expect(loadScene(engine)).toBeUndefined()
      expect(scene.meshes).toHaveLength(0)
      expect(loadScene(engine, null)).toBeUndefined()
      expect(scene.meshes).toHaveLength(0)
      expect()
    })

    it('displays loading UI on initial load only', () => {
      const displayLoadingUI = jest.spyOn(engine, 'displayLoadingUI')

      loadScene(engine, { cards: [card1] }, false)
      expect(displayLoadingUI).toHaveBeenCalledTimes(0)
      expect(scene.getMeshById(card1.id)).toBeDefined()

      loadScene(engine, { cards: [card1] })
      expect(displayLoadingUI).toHaveBeenCalledTimes(1)
      expect(scene.getMeshById(card1.id)).toBeDefined()
    })

    it('disposes all existing cards, tokens, tiles and boxes but leaves other meshes', () => {
      createBoard({ id: 'board' })
      createTable()
      createRoundToken({ id: 'token' })
      CreateBox('box', { width: 10, height: 10, depth: 10 })
      createRoundedTile({ id: 'tile' })
      createCard({ id: 'card' })

      expect(scene.getMeshById('board')).toBeDefined()
      expect(scene.getMeshById('table')).toBeDefined()
      expect(scene.getMeshById('token')).toBeDefined()
      expect(scene.getMeshById('box')).toBeDefined()
      expect(scene.getMeshById('tile')).toBeDefined()
      expect(scene.getMeshById('card')).toBeDefined()

      loadScene(engine, {})

      expect(scene.getMeshById('board')).toBeNull()
      expect(scene.getMeshById('table')).toBeDefined()
      expect(scene.getMeshById('token')).toBeNull()
      expect(scene.getMeshById('box')).toBeDefined()
      expect(scene.getMeshById('tile')).toBeNull()
      expect(scene.getMeshById('card')).toBeNull()
    })

    it('adds new meshes with their behaviors', () => {
      loadScene(engine, {
        cards: [card1, card2],
        roundTokens: [token1],
        roundedTiles: [tile1],
        boards: [board1]
      })
      expect(scene.getMeshById(card1.id)).toBeDefined()
      expect(scene.getMeshById(card1.id).metadata.serialize()).toEqual(card1)
      expect(scene.getMeshById(card2.id)).toBeDefined()
      expect(scene.getMeshById(card2.id).metadata.serialize()).toEqual(card2)
      expect(scene.getMeshById(token1.id)).toBeDefined()
      expect(scene.getMeshById(token1.id).metadata.serialize()).toEqual(token1)
      expect(scene.getMeshById(tile1.id)).toBeDefined()
      expect(scene.getMeshById(tile1.id).metadata.serialize()).toEqual(tile1)
      expect(scene.getMeshById(board1.id)).toBeDefined()
      expect(scene.getMeshById(board1.id).metadata.serialize()).toEqual(board1)
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
      const originalBoard = createBoard({
        id: board1.id,
        x: 10,
        y: 20,
        z: 30,
        movable: { snapDistance: 10, duration: 100 },
        anchorable: { anchors: [{ id: 1 }], duration: 100 }
      })
      loadScene(engine, {
        cards: [card1, card2],
        roundTokens: [token1],
        roundedTiles: [tile1],
        boards: [board1]
      })
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
      expect(scene.getMeshById(board1.id)).toBeDefined()
      expect(scene.getMeshById(board1.id).metadata.serialize()).toEqual({
        ...originalBoard.metadata.serialize(),
        x: board1.x,
        y: board1.y,
        z: board1.z,
        movable: board1.movable,
        anchorable: board1.anchorable
      })
    })

    it('restores mesh stacks', () => {
      let card1 = {
        id: 'card1',
        stackable: {
          duration: 100,
          extent: 0.5,
          kinds: 'card',
          isCylindric: false,
          stack: ['card2', 'card4', 'card3']
        }
      }
      loadScene(engine, {
        cards: [
          card1,
          { id: 'card2', stackable: { stack: [] } },
          { id: 'card3' },
          { id: 'card4' }
        ]
      })
      expect(scene.getMeshById(card1.id)).toBeDefined()
      expect(scene.getMeshById(card1.id).metadata.serialize()).toEqual({
        ...card1,
        depth: 0.01,
        height: 4.25,
        width: 3,
        x: 0,
        y: 0,
        z: 0
      })
    })
  })
})
