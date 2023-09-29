// @ts-check
import { faker } from '@faker-js/faker'
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

import die6Data from '../../../../games/assets/models/die6.obj?raw'
import die8Data from '../../../../games/assets/models/die8.obj?raw'
import pawnData from '../../fixtures/pawn.obj?raw'
import {
  expectAnimationEnd,
  expectPosition,
  initialize3dEngine
} from '../../test-utils'

/** @type {import('@babylonjs/core').Engine} */
let engine
/** @type {import('@babylonjs/core').Scene} */
let scene
/** @type {import('@babylonjs/core').Scene} */
let handScene
/** @type {import('@src/3d/utils').MeshCreator} */
let createBox
/** @type {import('@src/3d/utils').MeshCreator} */
let createCard
/** @type {import('@src/3d/utils').MeshCreator} */
let createCustom
/** @type {import('@src/3d/utils').MeshCreator} */
let createDie
/** @type {import('@src/3d/utils').MeshCreator} */
let createPrism
/** @type {import('@src/3d/utils').MeshCreator} */
let createRoundToken
/** @type {import('@src/3d/utils').MeshCreator} */
let createRoundedTile
const renderWidth = 2048
const renderHeight = 1024
const pawnFile = '/pawn.obj'
/** @type {import('@src/3d/managers').Managers} */
let managers

beforeAll(async () => {
  ;({ managers, scene, handScene, engine } = initialize3dEngine())
  // use dynamic import to break the cyclic dependency
  ;({
    createBox,
    createCard,
    // @ts-expect-error string|undefined is not compatible with {file: string}
    createCustom,
    createDie,
    createPrism,
    createRoundToken,
    createRoundedTile
  } = await import('@src/3d/meshes'))
  const getDieModelFile = (await import('@src/3d/meshes/die')).getDieModelFile
  vi.spyOn(global, 'fetch').mockImplementation(file =>
    Promise.resolve(
      new Response(
        file.toString().endsWith(pawnFile)
          ? pawnData
          : file.toString().endsWith(getDieModelFile(8))
          ? die8Data
          : die6Data
      )
    )
  )
  await managers.customShape.init({
    id: 'game',
    created: Date.now(),
    meshes: [
      { id: 'die6', shape: 'die', faces: 6, texture: '' },
      { id: 'die8', shape: 'die', faces: 8, texture: '' },
      { id: 'pawnTest', shape: 'custom', file: pawnFile, texture: '' }
    ]
  })
  managers.hand.enabled = true
})

afterAll(() => engine.dispose())

describe('serializeMeshes() 3D utility', () => {
  it('handles empty scene', () => {
    expect(serializeMeshes()).toEqual([])
  })

  describe('given an scene', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      for (const mesh of [...scene.meshes]) {
        mesh.dispose()
      }
      createTable({}, managers, scene)
    })

    it('can handle an empty scene', () => {
      expect(serializeMeshes(scene)).toEqual([])
    })

    it('serializes boxes', async () => {
      const box1 = await createBox({ id: 'box1', texture: '' }, managers, scene)
      const box2 = await createBox(
        {
          id: 'box2',
          texture: faker.internet.url(),
          x: faker.number.int(999),
          y: faker.number.int(999),
          z: faker.number.int(999),
          width: faker.number.int(999),
          height: faker.number.int(999),
          depth: faker.number.int(999)
        },
        managers,
        scene
      )
      expect(serializeMeshes(scene)).toEqual([
        box1.metadata.serialize(),
        box2.metadata.serialize()
      ])
    })

    it('serializes cards', async () => {
      const card1 = await createCard(
        { id: 'card1', texture: '' },
        managers,
        scene
      )
      const card2 = await createCard(
        {
          id: 'card2',
          texture: faker.internet.url(),
          x: faker.number.int(999),
          y: faker.number.int(999),
          z: faker.number.int(999),
          width: faker.number.int(999),
          height: faker.number.int(999),
          depth: faker.number.int(999)
        },
        managers,
        scene
      )
      expect(serializeMeshes(scene)).toEqual([
        card1.metadata.serialize(),
        card2.metadata.serialize()
      ])
    })

    it('serializes dice', async () => {
      const die6 = await createDie({ id: 'd6', texture: '' }, managers, scene)
      const die8 = await createBox(
        {
          id: 'd8',
          faces: 8,
          texture: faker.internet.url(),
          x: faker.number.int(999),
          y: faker.number.int(999),
          z: faker.number.int(999),
          diameter: faker.number.int(999)
        },
        managers,
        scene
      )
      expect(serializeMeshes(scene)).toEqual([
        die6.metadata.serialize(),
        die8.metadata.serialize()
      ])
    })

    it('serializes prism', async () => {
      const prism1 = await createPrism(
        { id: 'prism1', texture: '' },
        managers,
        scene
      )
      const prism2 = await createPrism(
        {
          id: 'prism2',
          texture: faker.internet.url(),
          x: faker.number.int(999),
          y: faker.number.int(999),
          z: faker.number.int(999),
          width: faker.number.int(999),
          edges: faker.number.int(999),
          depth: faker.number.int(999)
        },
        managers,
        scene
      )
      expect(serializeMeshes(scene)).toEqual([
        prism1.metadata.serialize(),
        prism2.metadata.serialize()
      ])
    })

    it('serializes round tokens', async () => {
      const token1 = await createRoundToken(
        { id: 'token1', texture: '' },
        managers,
        scene
      )
      const token2 = await createRoundToken(
        {
          id: 'token2',
          texture: faker.internet.url(),
          x: faker.number.int(999),
          y: faker.number.int(999),
          z: faker.number.int(999),
          diameter: faker.number.int(999),
          height: faker.number.int(999)
        },
        managers,
        scene
      )
      expect(serializeMeshes(scene)).toEqual([
        token1.metadata.serialize(),
        token2.metadata.serialize()
      ])
    })

    it('serializes rounded tiles', async () => {
      const tile1 = await createRoundedTile(
        { id: 'tile1', texture: '' },
        managers,
        scene
      )
      const tile2 = await createRoundedTile(
        {
          id: 'tile2',
          texture: faker.internet.url(),
          x: faker.number.int(999),
          y: faker.number.int(999),
          z: faker.number.int(999),
          borderRadius: faker.number.int(999),
          faceUV: [Array.from({ length: 4 }, () => faker.number.int(999))],
          width: faker.number.int(999),
          height: faker.number.int(999),
          depth: faker.number.int(999)
        },
        managers,
        scene
      )
      expect(serializeMeshes(scene)).toEqual([
        tile1.metadata.serialize(),
        tile2.metadata.serialize()
      ])
    })

    it('serializes custom shapes', async () => {
      const pawn1 = await createCustom(
        { id: 'pawn1', texture: '', file: pawnFile },
        managers,
        scene
      )
      expect(serializeMeshes(scene)).toEqual([pawn1.metadata.serialize()])
    })

    it('ignores phantom meshes', async () => {
      const tile1 = await createRoundedTile(
        { id: 'tile1', texture: '' },
        managers,
        scene
      )
      const tile2 = await createRoundedTile(
        {
          id: 'tile2',
          texture: faker.internet.url(),
          x: faker.number.int(999),
          y: faker.number.int(999),
          z: faker.number.int(999),
          borderRadius: faker.number.int(999),
          faceUV: [Array.from({ length: 4 }, () => faker.number.int(999))],
          width: faker.number.int(999),
          height: faker.number.int(999),
          depth: faker.number.int(999)
        },
        managers,
        scene
      )
      tile1.isPhantom = true
      expect(serializeMeshes(scene)).toEqual([tile2.metadata.serialize()])
    })

    it('keep track of meshes transitioning between scenes', async () => {
      const mesh = await createCard(
        { id: 'card1', texture: '', drawable: {} },
        managers,
        scene
      )
      const serialized = {
        ...mesh.metadata.serialize(),
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number)
      }
      managers.hand.draw(mesh)

      expect(serializeMeshes(scene)).toEqual([])
      expect(serializeMeshes(handScene)).toEqual([serialized])

      await expectAnimationEnd(getAnimatableBehavior(mesh))

      expect(serializeMeshes(scene)).toEqual([])
      expect(serializeMeshes(handScene)).toEqual([serialized])

      const handMesh = /** @type {import('@babylonjs/core').Mesh} */ (
        handScene.getMeshById(mesh.id)
      )
      managers.hand.play(handMesh)

      expect(serializeMeshes(scene)).toEqual([serialized])
      expect(serializeMeshes(handScene)).toEqual([])

      await expectAnimationEnd(
        getAnimatableBehavior(
          /** @type {import('@babylonjs/core').Mesh} */ (
            scene.getMeshById(handMesh.id)
          )
        )
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
    drawable: {
      duration: 750,
      flipOnPlay: false,
      unflipOnPick: true,
      angleOnPick: 0
    }
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
    expect(await loadMeshes(scene, [], managers)).toBeUndefined()
  })

  it('throws on unsupported shape', async () => {
    // @ts-expect-error 'unknown' is not a valid Shape
    await expect(loadMeshes(scene, [{ shape: 'unknown' }])).rejects.toThrow(
      'mesh shape unknown is not supported'
    )
  })

  it('disposes all existing cards, tokens, tiles and boxes but leaves other meshes', async () => {
    createTable(undefined, managers, scene)
    createRoundToken({ id: 'token', texture: '' }, managers, scene)
    createBox({ id: 'box', texture: '' }, managers, scene)
    createRoundedTile({ id: 'tile', texture: '' }, managers, scene)
    createCard({ id: 'card', texture: '' }, managers, scene)
    createPrism({ id: 'prism', texture: '' }, managers, scene)
    createDie({ id: 'die', texture: '' }, managers, scene)

    expect(scene.getMeshById('table')).toBeDefined()
    expect(scene.getMeshById('token')).toBeDefined()
    expect(scene.getMeshById('box')).toBeDefined()
    expect(scene.getMeshById('tile')).toBeDefined()
    expect(scene.getMeshById('card')).toBeDefined()
    expect(scene.getMeshById('prism')).toBeDefined()
    expect(scene.getMeshById('die')).toBeDefined()

    await loadMeshes(scene, [], managers)

    expect(scene.getMeshById('table')).toBeDefined()
    expect(scene.getMeshById('token')).toBeNull()
    expect(scene.getMeshById('box')).toBeNull()
    expect(scene.getMeshById('tile')).toBeNull()
    expect(scene.getMeshById('card')).toBeNull()
    expect(scene.getMeshById('prism')).toBeNull()
    expect(scene.getMeshById('die')).toBeNull()
  })

  it('adds new meshes with their behaviors', async () => {
    await loadMeshes(
      scene,
      /** @type {import('@tabulous/types').Mesh[]} */ ([
        card1,
        token1,
        tile1,
        card2,
        pawn1,
        box1,
        prism1,
        die1
      ]),
      managers
    )
    expect(scene.getMeshById(card1.id)).toBeDefined()
    expect(scene.getMeshById(card1.id)?.metadata.serialize()).toEqual(card1)
    expect(scene.getMeshById(card2.id)).toBeDefined()
    expect(scene.getMeshById(card2.id)?.metadata.serialize()).toEqual(card2)
    expect(scene.getMeshById(token1.id)).toBeDefined()
    expect(scene.getMeshById(token1.id)?.metadata.serialize()).toEqual(token1)
    expect(scene.getMeshById(tile1.id)).toBeDefined()
    expect(scene.getMeshById(tile1.id)?.metadata.serialize()).toEqual(tile1)
    expect(scene.getMeshById(pawn1.id)).toBeDefined()
    expect(scene.getMeshById(pawn1.id)?.metadata.serialize()).toEqual(pawn1)
    expect(scene.getMeshById(box1.id)).toBeDefined()
    expect(scene.getMeshById(box1.id)?.metadata.serialize()).toEqual(box1)
    expect(scene.getMeshById(prism1.id)).toBeDefined()
    expect(scene.getMeshById(prism1.id)?.metadata.serialize()).toEqual(prism1)
    expect(scene.getMeshById(die1.id)).toBeDefined()
    expect(scene.getMeshById(die1.id)?.metadata.serialize()).toEqual(die1)
  })

  it('updates existing meshes with their behaviors', async () => {
    const originalCard = await createCard(
      {
        id: card1.id,
        x: 21,
        y: 62,
        z: 52,
        texture: ''
      },
      managers,
      scene
    )
    const originalTile = await createRoundedTile(
      {
        id: tile1.id,
        x: -23,
        y: 0,
        z: -5.34,
        texture: ''
      },
      managers,
      scene
    )
    const originalToken = await createRoundToken(
      {
        id: token1.id,
        x: 10,
        y: 20,
        z: 30,
        flippable: { isFlipped: false },
        rotable: { angle: Math.PI * 2 },
        texture: ''
      },
      managers,
      scene
    )
    const originalPawn = await createCustom(
      {
        id: pawn1.id,
        file: pawnFile,
        x: 30,
        y: 20,
        z: 10,
        texture: ''
      },
      managers,
      scene
    )
    const originalBox = await createBox(
      {
        id: box1.id,
        x: -5,
        y: -6,
        z: -7,
        texture: ''
      },
      managers,
      scene
    )
    const originalPrism = await createPrism(
      {
        id: prism1.id,
        x: 10,
        y: 11,
        z: 12,
        texture: ''
      },
      managers,
      scene
    )
    const originalDie = await createDie(
      {
        id: die1.id,
        x: -2,
        y: 5,
        z: 3,
        randomizable: { face: 6 },
        texture: ''
      },
      managers,
      scene
    )
    await loadMeshes(
      scene,
      /** @type {import('@tabulous/types').Mesh[]} */ ([
        card1,
        card2,
        token1,
        tile1,
        pawn1,
        box1,
        prism1,
        die1
      ]),
      managers
    )
    expect(scene.getMeshById(card1.id)).toBeDefined()
    expect(scene.getMeshById(card1.id)?.metadata.serialize()).toEqual({
      ...originalCard.metadata.serialize(),
      x: card1.x,
      y: card1.y,
      z: card1.z
    })
    expect(scene.getMeshById(card2.id)).toBeDefined()
    expect(scene.getMeshById(card2.id)?.metadata.serialize()).toEqual(card2)
    expect(scene.getMeshById(token1.id)).toBeDefined()
    expect(scene.getMeshById(token1.id)?.metadata.serialize()).toEqual({
      ...originalToken.metadata.serialize(),
      x: token1.x,
      y: token1.y,
      z: token1.z,
      flippable: token1.flippable,
      rotable: token1.rotable
    })
    expect(scene.getMeshById(tile1.id)).toBeDefined()
    expect(scene.getMeshById(tile1.id)?.metadata.serialize()).toEqual({
      ...originalTile.metadata.serialize(),
      x: tile1.x,
      y: tile1.y,
      z: tile1.z
    })
    expect(scene.getMeshById(pawn1.id)).toBeDefined()
    expect(scene.getMeshById(pawn1.id)?.metadata.serialize()).toEqual({
      ...originalPawn.metadata.serialize(),
      x: pawn1.x,
      y: pawn1.y,
      z: pawn1.z
    })
    expect(scene.getMeshById(box1.id)).toBeDefined()
    expect(scene.getMeshById(box1.id)?.metadata.serialize()).toEqual({
      ...originalBox.metadata.serialize(),
      x: box1.x,
      y: box1.y,
      z: box1.z
    })
    expect(scene.getMeshById(prism1.id)).toBeDefined()
    expect(scene.getMeshById(prism1.id)?.metadata.serialize()).toEqual({
      ...originalPrism.metadata.serialize(),
      x: prism1.x,
      y: prism1.y,
      z: prism1.z
    })
    expect(scene.getMeshById(die1.id)).toBeDefined()
    expect(scene.getMeshById(die1.id)?.metadata.serialize()).toEqual({
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
    await loadMeshes(
      scene,
      /** @type {import('@tabulous/types').Mesh[]} */ ([
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
      ]),
      managers
    )
    const mesh1 = scene.getMeshById(card1.id)
    expect(mesh1).not.toBeNull()
    expect(mesh1?.metadata.serialize()).toEqual({
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
    expect(mesh5?.metadata.serialize()).toEqual({
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

    await loadMeshes(
      scene,
      /** @type {import('@tabulous/types').Mesh[]} */ ([
        card4,
        card1,
        { shape: 'card', id: 'card2', movable: {} },
        { shape: 'card', id: 'card3', movable: {} }
      ]),
      managers
    )
    const mesh1 = scene.getMeshById(card1.id)
    expect(mesh1).not.toBeNull()
    expectPosition(mesh1, [pos1.x, pos1.y, pos1.z])
    expect(mesh1?.metadata.serialize()).toEqual({
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
