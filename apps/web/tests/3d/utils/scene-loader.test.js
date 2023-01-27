import { faker } from '@faker-js/faker'
import { customShapeManager, handManager } from '@src/3d/managers'
import { getDieModelFile } from '@src/3d/meshes/die'
import {
  altitudeGap,
  createTable,
  getAnimatableBehavior,
  loadMeshes,
  removeNulls,
  serializeMeshes
} from '@src/3d/utils'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import die6Data from '../../../../games/models/die6.obj?raw'
import die8Data from '../../../../games/models/die8.obj?raw'
import pawnData from '../../fixtures/pawn.obj?raw'
import {
  expectAnimationEnd,
  expectPosition,
  initialize3dEngine
} from '../../test-utils'

vi.mock('@src/3d/managers/custom-shape', () => ({
  customShapeManager: new Map()
}))

let engine
let scene
let handScene
let createBox
let createCard
let createCustom
let createDie
let createPrism
let createRoundToken
let createRoundedTile
const renderWidth = 2048
const renderHeight = 1024
const pawnFile = '/pawn.obj'

beforeAll(async () => {
  engine = initialize3dEngine().engine
  // use dynamic import to break the cyclic dependency
  ;({
    createBox,
    createCard,
    createCustom,
    createDie,
    createPrism,
    createRoundToken,
    createRoundedTile
  } = await import('@src/3d/meshes'))
  customShapeManager.set(pawnFile, btoa(pawnData))
  customShapeManager.set(getDieModelFile(6), btoa(die6Data))
  customShapeManager.set(getDieModelFile(8), btoa(die8Data))
})

afterAll(() => engine.dispose())

describe('serializeMeshes() 3D utility', () => {
  const overlay = document.createElement('div')
  const renderWidth = 480
  const renderHeight = 350

  it('handles empty scene', () => {
    expect(serializeMeshes()).toEqual([])
  })

  describe('given an scene', () => {
    beforeAll(() => {
      ;({ engine, scene, handScene } = initialize3dEngine(
        {
          renderWidth,
          renderHeight
        },
        { renderWidth, renderHeight }
      ))
      handManager.init({ scene, handScene, overlay })
    })

    beforeEach(() => {
      vi.restoreAllMocks()
      vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
        height: `${renderHeight / 4}px`
      }))
      for (const mesh of [...scene.meshes]) {
        mesh.dispose()
      }
      createTable({}, scene)
    })

    it('can handle an empty scene', () => {
      expect(serializeMeshes(scene)).toEqual([])
    })

    it('serializes boxes', async () => {
      const box1 = await createBox({ id: 'box1' })
      const box2 = await createBox({
        id: 'box2',
        texture: faker.internet.url(),
        images: [faker.random.word()],
        x: faker.datatype.number(),
        y: faker.datatype.number(),
        z: faker.datatype.number(),
        width: faker.datatype.number(),
        height: faker.datatype.number(),
        depth: faker.datatype.number()
      })
      expect(serializeMeshes(scene)).toEqual([
        box1.metadata.serialize(),
        box2.metadata.serialize()
      ])
    })

    it('serializes cards', async () => {
      const card1 = await createCard({ id: 'card1' })
      const card2 = await createCard({
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
      expect(serializeMeshes(scene)).toEqual([
        card1.metadata.serialize(),
        card2.metadata.serialize()
      ])
    })

    it('serializes dice', async () => {
      const die6 = await createDie({ id: 'd6' })
      const die8 = await createBox({
        id: 'd8',
        faces: 8,
        texture: faker.internet.url(),
        images: [faker.random.word()],
        x: faker.datatype.number(),
        y: faker.datatype.number(),
        z: faker.datatype.number(),
        diameter: faker.datatype.number()
      })
      expect(serializeMeshes(scene)).toEqual([
        die6.metadata.serialize(),
        die8.metadata.serialize()
      ])
    })

    it('serializes prism', async () => {
      const prism1 = await createPrism({ id: 'prism1' })
      const prism2 = await createPrism({
        id: 'prism2',
        texture: faker.internet.url(),
        images: [faker.random.word()],
        prismRotation: faker.datatype.number(),
        x: faker.datatype.number(),
        y: faker.datatype.number(),
        z: faker.datatype.number(),
        width: faker.datatype.number(),
        edges: faker.datatype.number(),
        depth: faker.datatype.number()
      })
      expect(serializeMeshes(scene)).toEqual([
        prism1.metadata.serialize(),
        prism2.metadata.serialize()
      ])
    })

    it('serializes round tokens', async () => {
      const token1 = await createRoundToken({ id: 'token1' })
      const token2 = await createRoundToken({
        id: 'token2',
        texture: faker.internet.url(),
        images: [faker.random.word()],
        x: faker.datatype.number(),
        y: faker.datatype.number(),
        z: faker.datatype.number(),
        diameter: faker.datatype.number(),
        height: faker.datatype.number()
      })
      expect(serializeMeshes(scene)).toEqual([
        token1.metadata.serialize(),
        token2.metadata.serialize()
      ])
    })

    it('serializes rounded tiles', async () => {
      const tile1 = await createRoundedTile({ id: 'tile1' })
      const tile2 = await createRoundedTile({
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
      expect(serializeMeshes(scene)).toEqual([
        tile1.metadata.serialize(),
        tile2.metadata.serialize()
      ])
    })

    it('serializes custom shapes', async () => {
      const pawn1 = await createCustom({ id: 'pawn1', file: pawnFile })
      expect(serializeMeshes(scene)).toEqual([pawn1.metadata.serialize()])
    })

    it('ignores phantom meshes', async () => {
      const tile1 = await createRoundedTile({ id: 'tile1' })
      const tile2 = await createRoundedTile({
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
      tile1.isPhantom = true
      expect(serializeMeshes(scene)).toEqual([tile2.metadata.serialize()])
    })

    it('keep tracks of meshes transitioning between scenes', async () => {
      const mesh = await createCard({ id: 'card1', drawable: {} })
      const serialized = {
        ...mesh.metadata.serialize(),
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number)
      }
      handManager.draw(mesh)

      expect(serializeMeshes(scene)).toEqual([])
      expect(serializeMeshes(handScene)).toEqual([serialized])

      await expectAnimationEnd(getAnimatableBehavior(mesh))

      expect(serializeMeshes(scene)).toEqual([])
      expect(serializeMeshes(handScene)).toEqual([serialized])

      const handMesh = handScene.getMeshById(mesh.id)
      handManager.draw(handMesh)

      expect(serializeMeshes(scene)).toEqual([serialized])
      expect(serializeMeshes(handScene)).toEqual([])

      await expectAnimationEnd(
        getAnimatableBehavior(scene.getMeshById(mesh.id))
      )

      expect(serializeMeshes(scene)).toEqual([serialized])
      expect(serializeMeshes(handScene)).toEqual([])
    })
  })
})

describe('loadMeshes() 3D utility', () => {
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

  let pawn1 = {
    shape: 'custom',
    id: 'pawn1',
    file: pawnFile,
    x: 10,
    y: 5,
    z: -10
  }

  let die1 = {
    shape: 'die',
    id: 'd6',
    faces: 6,
    x: 5,
    y: 1,
    z: 2.5,
    diameter: 1.7,
    texture: 'https://obviously.org',
    randomizable: { duration: 300, canBeSet: true, face: 3 }
  }

  let box1 = {
    shape: 'box',
    id: 'box1',
    texture: 'https://obviously.org',
    height: 1,
    width: 1,
    depth: 1,
    x: -2,
    y: 1,
    z: -5,
    faceUV: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0.5, 1, 0, 0],
      [0.5, 0, 1, 1]
    ],
    drawable: { duration: 750, flipOnPlay: false, unflipOnPick: true }
  }

  let prism1 = {
    shape: 'prism',
    height: 4.2,
    id: 'prism1',
    texture: 'https://elyse.biz',
    faceUV: [
      [0 / 3, 0, 1 / 3, 1],
      [1 / 3, 0, 2 / 3, 1],
      [2 / 3, 0, 3 / 3, 1]
    ],
    prismRotation: Math.PI,
    edges: 8,
    width: 7.8,
    x: 30,
    y: 5,
    z: -25,
    quantifiable: { quantity: 1, duration: 100, extent: 2 },
    movable: { snapDistance: 0.1, duration: 100 }
  }

  beforeAll(() => {
    ;({ engine, scene } = initialize3dEngine({ renderWidth, renderHeight }))
  })

  beforeEach(() => {
    for (const mesh of [...scene.meshes]) {
      mesh.dispose()
    }
  })

  it('handles empty input', async () => {
    expect(await loadMeshes(scene, [])).toBeUndefined()
  })

  it('throws on unsupported shape', async () => {
    await expect(loadMeshes(scene, [{ shape: 'unknown' }])).rejects.toThrow(
      'mesh shape unknown is not supported'
    )
  })

  it('disposes all existing cards, tokens, tiles and boxes but leaves other meshes', async () => {
    createTable()
    createRoundToken({ id: 'token' })
    createBox({ id: 'box' })
    createRoundedTile({ id: 'tile' })
    createCard({ id: 'card' })
    createPrism({ id: 'prism' })
    createDie({ id: 'die' })

    expect(scene.getMeshById('table')).toBeDefined()
    expect(scene.getMeshById('token')).toBeDefined()
    expect(scene.getMeshById('box')).toBeDefined()
    expect(scene.getMeshById('tile')).toBeDefined()
    expect(scene.getMeshById('card')).toBeDefined()
    expect(scene.getMeshById('prism')).toBeDefined()
    expect(scene.getMeshById('die')).toBeDefined()

    await loadMeshes(scene, [])

    expect(scene.getMeshById('table')).toBeDefined()
    expect(scene.getMeshById('token')).toBeNull()
    expect(scene.getMeshById('box')).toBeNull()
    expect(scene.getMeshById('tile')).toBeNull()
    expect(scene.getMeshById('card')).toBeNull()
    expect(scene.getMeshById('prism')).toBeNull()
    expect(scene.getMeshById('die')).toBeNull()
  })

  it('adds new meshes with their behaviors', async () => {
    await loadMeshes(scene, [
      card1,
      token1,
      tile1,
      card2,
      pawn1,
      box1,
      prism1,
      die1
    ])
    expect(scene.getMeshById(card1.id)).toBeDefined()
    expect(scene.getMeshById(card1.id).metadata.serialize()).toEqual(card1)
    expect(scene.getMeshById(card2.id)).toBeDefined()
    expect(scene.getMeshById(card2.id).metadata.serialize()).toEqual(card2)
    expect(scene.getMeshById(token1.id)).toBeDefined()
    expect(scene.getMeshById(token1.id).metadata.serialize()).toEqual(token1)
    expect(scene.getMeshById(tile1.id)).toBeDefined()
    expect(scene.getMeshById(tile1.id).metadata.serialize()).toEqual(tile1)
    expect(scene.getMeshById(pawn1.id)).toBeDefined()
    expect(scene.getMeshById(pawn1.id).metadata.serialize()).toEqual(pawn1)
    expect(scene.getMeshById(box1.id)).toBeDefined()
    expect(scene.getMeshById(box1.id).metadata.serialize()).toEqual(box1)
    expect(scene.getMeshById(prism1.id)).toBeDefined()
    expect(scene.getMeshById(prism1.id).metadata.serialize()).toEqual(prism1)
    expect(scene.getMeshById(die1.id)).toBeDefined()
    expect(scene.getMeshById(die1.id).metadata.serialize()).toEqual(die1)
  })

  it('updates existing meshes with their behaviors', async () => {
    const originalCard = await createCard({
      id: card1.id,
      x: 21,
      y: 62,
      z: 52
    })
    const originalTile = await createRoundedTile({
      id: tile1.id,
      x: -23,
      y: 0,
      z: -5.34
    })
    const originalToken = await createRoundToken({
      id: token1.id,
      x: 10,
      y: 20,
      z: 30,
      flippable: { isFlipped: false },
      rotable: { angle: Math.PI * 2 }
    })
    const originalPawn = await createCustom({
      id: pawn1.id,
      file: pawnFile,
      x: 30,
      y: 20,
      z: 10
    })
    const originalBox = await createBox({
      id: box1.id,
      x: -5,
      y: -6,
      z: -7
    })
    const originalPrism = await createPrism({
      id: prism1.id,
      x: 10,
      y: 11,
      z: 12
    })
    const originalDie = await createDie({
      id: die1.id,
      x: -2,
      y: 5,
      z: 3,
      randomizable: { face: 6 }
    })
    await loadMeshes(scene, [
      card1,
      card2,
      token1,
      tile1,
      pawn1,
      box1,
      prism1,
      die1
    ])
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
    expect(scene.getMeshById(pawn1.id)).toBeDefined()
    expect(scene.getMeshById(pawn1.id).metadata.serialize()).toEqual({
      ...originalPawn.metadata.serialize(),
      x: pawn1.x,
      y: pawn1.y,
      z: pawn1.z
    })
    expect(scene.getMeshById(box1.id)).toBeDefined()
    expect(scene.getMeshById(box1.id).metadata.serialize()).toEqual({
      ...originalBox.metadata.serialize(),
      x: box1.x,
      y: box1.y,
      z: box1.z
    })
    expect(scene.getMeshById(prism1.id)).toBeDefined()
    expect(scene.getMeshById(prism1.id).metadata.serialize()).toEqual({
      ...originalPrism.metadata.serialize(),
      x: prism1.x,
      y: prism1.y,
      z: prism1.z
    })
    expect(scene.getMeshById(die1.id)).toBeDefined()
    expect(scene.getMeshById(die1.id).metadata.serialize()).toEqual({
      ...originalDie.metadata.serialize(),
      x: die1.x,
      y: die1.y,
      z: die1.z,
      randomizable: die1.randomizable
    })
  })

  it('restores mesh stacks with proper Y-ordering', async () => {
    const card1 = {
      shape: 'card',
      id: 'card1',
      stackable: {
        duration: 100,
        extent: 0.5,
        kinds: 'card',
        stackIds: ['card2', 'card4', 'card3']
      },
      movable: {}
    }
    const card5 = {
      shape: 'card',
      id: 'card5',
      stackable: {
        duration: 100,
        extent: 0.5,
        kinds: 'card',
        stackIds: ['card6']
      },
      x: -5,
      y: 2,
      z: -5,
      movable: {}
    }
    await loadMeshes(scene, [
      card5,
      card1,
      {
        shape: 'card',
        id: 'card2',
        stackable: { stackIds: [] },
        movable: {}
      },
      { shape: 'card', id: 'card3', movable: {} },
      { shape: 'card', id: 'card4', movable: {} },
      { shape: 'card', id: 'card6', movable: {} }
    ])
    const mesh1 = scene.getMeshById(card1.id)
    expect(mesh1).not.toBeNull()
    expect(mesh1.metadata.serialize()).toEqual({
      ...card1,
      depth: 4.25,
      height: 0.01,
      width: 3,
      faceUV: [
        [0.5, 1, 0, 0],
        [0.5, 0, 1, 1]
      ],
      x: 0,
      y: 0,
      z: 0,
      movable: { duration: 100, snapDistance: 0.25 }
    })
    const mesh5 = scene.getMeshById(card5.id)
    expect(mesh5).not.toBeNull()
    expect(mesh5.metadata.serialize()).toEqual({
      ...card5,
      depth: 4.25,
      height: 0.01,
      width: 3,
      faceUV: [
        [0.5, 1, 0, 0],
        [0.5, 0, 1, 1]
      ],
      movable: { duration: 100, snapDistance: 0.25 }
    })
  })

  it('restores mesh anchors with proper Y-ordering', async () => {
    const pos1 = { x: 2, y: 2, z: 4 }
    const shift = 2
    const height = 0.01
    const card1 = {
      shape: 'card',
      id: 'card1',
      ...pos1,
      anchorable: {
        duration: 100,
        anchors: [
          { snappedId: 'card2', x: shift },
          { snappedId: 'card4', x: -shift }
        ]
      },
      movable: {}
    }
    const card4 = {
      shape: 'card',
      id: 'card4',
      anchorable: {
        duration: 100,
        anchors: [{ snappedId: 'card3' }]
      },
      x: -5,
      y: 2.001,
      z: -5,
      movable: {}
    }

    await loadMeshes(scene, [
      card4,
      card1,
      { shape: 'card', id: 'card2', movable: {} },
      { shape: 'card', id: 'card3', movable: {} }
    ])
    const mesh1 = scene.getMeshById(card1.id)
    expect(mesh1).not.toBeNull()
    expectPosition(mesh1, [pos1.x, pos1.y, pos1.z])
    expect(mesh1.metadata.serialize()).toEqual({
      ...card1,
      ...pos1,
      movable: { duration: 100, snapDistance: 0.25 },
      depth: 4.25,
      height,
      width: 3,
      faceUV: [
        [0.5, 1, 0, 0],
        [0.5, 0, 1, 1]
      ]
    })

    const mesh2 = scene.getMeshById('card2')
    expect(mesh2).not.toBeNull()
    expectPosition(mesh2, [
      pos1.x + shift,
      pos1.y + height + altitudeGap,
      pos1.z
    ])

    const mesh4 = scene.getMeshById('card4')
    expect(mesh4).not.toBeNull()
    expectPosition(mesh4, [
      pos1.x - shift,
      pos1.y + height + altitudeGap,
      pos1.z
    ])

    const mesh3 = scene.getMeshById('card3')
    expect(mesh3).not.toBeNull()
    expectPosition(mesh3, [
      pos1.x - shift,
      pos1.y + (height + altitudeGap) * 2,
      pos1.z
    ])
  })
})

describe('removeNulls()', () => {
  it('removes null from object', () => {
    const card = {
      texture: 'https://elyse.biz',
      width: 7.8,
      x: 21,
      y: null,
      z: null
    }
    expect(removeNulls(card)).toEqual({
      ...card,
      y: undefined,
      z: undefined
    })
  })

  it('removes null in arrays', () => {
    const card = {
      texture: 'https://elyse.biz',
      width: null,
      color: [1, 2, null, 3]
    }
    expect(removeNulls(card)).toEqual({
      ...card,
      width: undefined,
      color: [1, 2, undefined, 3]
    })
  })

  it('removes null from nested objects', () => {
    const card = {
      texture: 'https://elyse.biz',
      dimensions: { width: null, height: 0.01 },
      children: [
        { id: 1, value: null },
        { id: 2, value: 'foo' }
      ]
    }
    expect(removeNulls(card)).toEqual({
      texture: 'https://elyse.biz',
      dimensions: { height: 0.01 },
      children: [{ id: 1 }, { id: 2, value: 'foo' }]
    })
  })
})
