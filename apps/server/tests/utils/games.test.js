import { faker } from '@faker-js/faker'
import { vi } from 'vitest'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  buildCameraPosition,
  createMeshes,
  decrement,
  draw,
  drawInHand,
  enrichAssets,
  findAnchor,
  findAvailableValues,
  findMesh,
  findOrCreateHand,
  getParameterSchema,
  snapTo,
  stackMeshes,
  unsnap
} from '../../src/utils/games.js'
import { cloneAsJSON } from '../test-utils.js'

describe('createMeshes()', () => {
  it('ignores missing mesh', async () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      build: () => ({
        meshes: ids.map(id => ({ id })),
        bags: new Map([['cards', ['card-null', 'card-1', 'card', 'card-2']]]),
        slots: [{ bagId: 'cards', x: 1, y: 2, z: 3 }]
      })
    }
    expect(await createMeshes('cards', descriptor)).toEqual(
      expect.arrayContaining(
        descriptor.build().meshes.map(expect.objectContaining)
      )
    )
  })

  it('ignores missing bags', async () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      build: () => ({
        meshes: ids.map(id => ({ id })),
        bags: new Map([['cards', ids]]),
        slots: [{ bagId: 'unknown', x: 1, y: 2, z: 3 }, { bagId: 'cards' }]
      })
    }
    expect(await createMeshes('cards', descriptor)).toEqual(
      descriptor.build().meshes.map(expect.objectContaining)
    )
  })

  it('trims out mesh dandling in bags', async () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      build: () => ({
        meshes: ids.map(id => ({ id })),
        bags: new Map([['cards', ids]])
      })
    }
    expect(await createMeshes('cards', descriptor)).toEqual([])
  })

  it('ignores no bags', async () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      build: () => ({
        meshes: ids.map(id => ({ id })),
        slots: [{ bagId: 'unknown', x: 1, y: 2, z: 3 }]
      })
    }
    expect(await createMeshes('cards', descriptor)).toEqual(
      descriptor.build().meshes
    )
  })

  describe('given a descriptor with a count slot and a countless slot on the same bag', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      build: () => ({
        meshes: ids.map(id => ({ id })),
        bags: new Map([['cards', ids]]),
        slots: [
          { bagId: 'cards', x: 1, y: 2, z: 3, count: 2 },
          { bagId: 'cards', x: 2, y: 3, z: 4 }
        ]
      })
    }

    it('stacks meshes on slots with random order', async () => {
      const {
        meshes: originals,
        slots: [slot1, slot2]
      } = descriptor.build()
      const meshes = await createMeshes('cards', descriptor)
      expect(meshes).toEqual(
        expect.arrayContaining(originals.map(expect.objectContaining))
      )
      expect(meshes).not.toEqual(originals)
      expectStackedOnSlot(meshes, slot1)
      expectStackedOnSlot(meshes, slot2, 8)
    })

    it('applies different slot order on different games', async () => {
      const { meshes: originals } = descriptor.build()
      const meshes1 = await createMeshes('cards', descriptor)
      const meshes2 = await createMeshes('cards', descriptor)
      expect(meshes1).not.toEqual(originals)
      expect(meshes2).not.toEqual(originals)
      expect(meshes1).not.toEqual(meshes2)
    })
  })

  describe('given a descriptor with multiple count slots on the same bag', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      build: () => ({
        meshes: ids.map(id => ({ id })),
        bags: new Map([['cards', ids]]),
        slots: [
          { bagId: 'cards', x: 1, y: 2, z: 3, count: 2 },
          { bagId: 'cards', x: 2, y: 3, z: 4, count: 3 }
        ]
      })
    }

    it('removes remaining meshes after processing all slots', async () => {
      const {
        slots: [slot1, slot2]
      } = descriptor.build()
      const meshes = await createMeshes('cards', descriptor)
      expect(meshes).toHaveLength(slot1.count + slot2.count)
      expectStackedOnSlot(meshes, slot1)
      expectStackedOnSlot(meshes, slot2)
    })
  })

  describe('given a descriptor with multiple slots on the same anchor', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const boardId = 'board'
    const descriptor = {
      build: () => ({
        meshes: [
          ...ids.map(id => ({ id })),
          { id: boardId, anchorable: { anchors: [{ id: 'anchor' }] } }
        ],
        bags: new Map([['cards', ids]]),
        slots: [
          { bagId: 'cards', anchorId: 'anchor', count: 2 },
          { bagId: 'cards', anchorId: 'anchor', count: 3 },
          { bagId: 'cards', anchorId: 'anchor' }
        ]
      })
    }

    it('push meshes to the same stack', async () => {
      const {
        slots: [slot]
      } = descriptor.build()
      const meshes = await createMeshes('cards', descriptor)
      expect(meshes).toHaveLength(ids.length + 1)
      const { id: stackId } = expectStackedOnSlot(meshes, slot, ids.length)
      const board = meshes.find(({ id }) => id === boardId)
      expect(board).toBeDefined()
      expect(board.anchorable.anchors[0].snappedId).toEqual(stackId)
    })
  })

  describe('given a descriptor with anchorable board', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const initialMeshes = [
      {
        id: 'board',
        anchorable: {
          anchors: [{ id: 'first' }, { id: 'second' }, { id: 'third' }]
        }
      },
      ...ids.map(id => ({
        id,
        anchorable: { anchors: [{ id: 'top' }, { id: 'bottom' }] }
      }))
    ]
    const bags = new Map([['cards', ids]])

    it('snaps a random mesh on anchor', async () => {
      const slots = [
        { bagId: 'cards', anchorId: 'first', count: 1, name: 'first' },
        { bagId: 'cards', anchorId: 'third', count: 1, name: 'third' }
      ]
      const meshes = await createMeshes('cards', {
        build: () => ({ meshes: initialMeshes, slots, bags })
      })
      const board = meshes.find(({ id }) => id === 'board')
      expect(board).toBeDefined()

      expectSnappedByName(meshes, slots[0].name, board.anchorable.anchors[0])
      expect(board.anchorable.anchors[1].snappedId).toBeUndefined()
      expectSnappedByName(meshes, slots[1].name, board.anchorable.anchors[2])
    })

    it('does not snap on unknown anchor', async () => {
      const slots = [
        { bagId: 'cards', anchorId: 'first', count: 1, name: 'first' },
        { bagId: 'cards', anchorId: 'unknown', count: 1, name: 'unsnapped' }
      ]
      const meshes = await createMeshes('cards', {
        build: () => ({ meshes: initialMeshes, slots, bags })
      })
      const board = meshes.find(({ id }) => id === 'board')
      expect(board).toBeDefined()

      expectSnappedByName(meshes, slots[0].name, board.anchorable.anchors[0])
      expect(board.anchorable.anchors[1].snappedId).toBeUndefined()
      expect(board.anchorable.anchors[2].snappedId).toBeUndefined()
      const unsnapped = meshes.find(mesh => mesh.name === slots[1].name)
      expect(unsnapped).toBeDefined()
      for (const {
        anchorable: { anchors }
      } of meshes) {
        for (const anchor of anchors) {
          expect(anchor.snappedId).not.toEqual(unsnapped.id)
        }
      }
    })

    it('snaps a random mesh on chained anchor', async () => {
      const slots = [
        { bagId: 'cards', anchorId: 'second', count: 1, name: 'base' },
        { bagId: 'cards', anchorId: 'second.top', count: 1, name: 'top' },
        { bagId: 'cards', anchorId: 'second.bottom', count: 1, name: 'bottom' }
      ]
      const meshes = await createMeshes('cards', {
        build: () => ({ meshes: initialMeshes, slots, bags })
      })
      const board = meshes.find(({ id }) => id === 'board')
      expect(board).toBeDefined()

      expect(board.anchorable.anchors[0].snappedId).toBeUndefined()
      expectSnappedByName(meshes, 'base', board.anchorable.anchors[1])
      expect(board.anchorable.anchors[2].snappedId).toBeUndefined()

      const base = meshes.find(mesh => mesh.name === 'base')
      expectSnappedByName(meshes, 'top', base.anchorable.anchors[0])
      expectSnappedByName(meshes, 'bottom', base.anchorable.anchors[1])
    })

    it('snaps a random mesh on long chained anchor', async () => {
      const slots = [
        { bagId: 'cards', anchorId: 'second', count: 1, name: 'base' },
        { bagId: 'cards', anchorId: 'second.top', count: 1, name: 'first' },
        {
          bagId: 'cards',
          anchorId: 'second.top.top',
          count: 1,
          name: 'second'
        },
        {
          bagId: 'cards',
          anchorId: 'second.top.top.bottom',
          count: 1,
          name: 'third'
        }
      ]
      const meshes = await createMeshes('cards', {
        build: () => ({ meshes: initialMeshes, slots, bags })
      })
      const board = meshes.find(({ id }) => id === 'board')
      expect(board).toBeDefined()

      expect(board.anchorable.anchors[0].snappedId).toBeUndefined()
      expectSnappedByName(meshes, 'base', board.anchorable.anchors[1])
      expect(board.anchorable.anchors[2].snappedId).toBeUndefined()

      const base = meshes.find(mesh => mesh.name === 'base')
      expectSnappedByName(meshes, 'first', base.anchorable.anchors[0])
      expect(base.anchorable.anchors[1].snappedId).toBeUndefined()

      const first = meshes.find(mesh => mesh.name === 'first')
      expectSnappedByName(meshes, 'second', first.anchorable.anchors[0])
      expect(first.anchorable.anchors[1].snappedId).toBeUndefined()

      const second = meshes.find(mesh => mesh.name === 'second')
      expectSnappedByName(meshes, 'third', second.anchorable.anchors[1])
      expect(second.anchorable.anchors[0].snappedId).toBeUndefined()

      const third = meshes.find(mesh => mesh.name === 'third')
      expect(third.anchorable.anchors[0].snappedId).toBeUndefined()
      expect(third.anchorable.anchors[1].snappedId).toBeUndefined()
    })

    it('can stack on top of an anchor', async () => {
      const slots = [
        { bagId: 'cards', anchorId: 'second', count: 3, name: 'base' }
      ]
      const meshes = await createMeshes('cards', {
        build: () => ({
          meshes: [initialMeshes[0], ...ids.map(id => ({ id }))],
          slots,
          bags
        })
      })
      const board = meshes.find(({ id }) => id === 'board')
      const snapped = meshes.filter(mesh => mesh.name === 'base')
      expect(board).toBeDefined()
      expect(snapped).toHaveLength(3)
      expect(board.anchorable.anchors[0].snappedId).toBeUndefined()
      const base = snapped.filter(mesh => mesh.stackable)
      expect(base).toHaveLength(1)
      expect(base[0].stackable.stackIds).toEqual(
        expect.arrayContaining(
          snapped.filter(mesh => mesh !== base[0]).map(({ id }) => id)
        )
      )
    })

    it('can mix stack and anchors', async () => {
      const slots = [
        { bagId: 'cards', anchorId: 'second', count: 1, name: 'base' },
        { bagId: 'cards', x: 1, z: 2 }
      ]
      const meshes = await createMeshes('cards', {
        build: () => ({
          meshes: [...ids.map(id => ({ id })), initialMeshes[0]],
          slots,
          bags
        })
      })
      const board = meshes.find(({ id }) => id === 'board')
      const base = meshes.find(mesh => mesh.name === 'base')
      expect(board).toBeDefined()
      expect(base).toBeDefined()
      expect(base.x).toBeUndefined()
      expect(board.anchorable.anchors[0].snappedId).toBeUndefined()
      expectSnappedByName(meshes, 'base', board.anchorable.anchors[1])
      expect(board.anchorable.anchors[2].snappedId).toBeUndefined()
      expect(
        meshes
          .filter(mesh => mesh.name !== 'base' && mesh.id !== 'board')
          .every(({ x }) => x === 1)
      ).toBe(true)
    })
  })

  describe('given a descriptor with multiple slots on the same bag', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      build: () => ({
        meshes: ids.map(id => ({ id })),
        bags: new Map([['cards', ids]]),
        slots: [
          { bagId: 'cards', x: 10, count: 2 },
          { bagId: 'cards', x: 5, count: 1 },
          { bagId: 'cards', x: 1 }
        ]
      })
    }

    it('draws meshes to fill slots', async () => {
      const meshes = await createMeshes('cards', descriptor)
      expect(meshes).toEqual(
        expect.arrayContaining(
          descriptor.build().meshes.map(expect.objectContaining)
        )
      )
      expect(
        meshes.filter(({ stackable }) => stackable?.stackIds.length === 1)
      ).toHaveLength(1)
      expect(meshes.filter(({ x }) => x === 10)).toHaveLength(2)
      expect(meshes.filter(({ x }) => x === 5)).toHaveLength(1)
      expect(
        meshes.filter(({ stackable }) => stackable?.stackIds.length === 6)
      ).toHaveLength(1)
      expect(meshes.filter(({ x }) => x === 1)).toHaveLength(7)
    })
  })
})

describe('enrichAssets()', () => {
  it('enriches mesh relative texture', () => {
    const kind = faker.lorem.word()
    const texture = faker.system.commonFileName('png')
    expect(
      enrichAssets({ kind, meshes: [{ id: 1, texture }], hands: [] }).meshes[0]
        .texture
    ).toEqual(`/${kind}/textures/${texture}`)
  })

  it('does not enrich mesh absolute texture', () => {
    const kind = faker.lorem.word()
    const texture = faker.system.filePath()
    expect(
      enrichAssets({ kind, meshes: [{ id: 1, texture }], hands: [] }).meshes[0]
        .texture
    ).toEqual(texture)
  })

  it('does not enrich mesh colored texture', () => {
    const kind = faker.lorem.word()
    const texture = faker.internet.color()
    expect(
      enrichAssets({ kind, meshes: [{ id: 1, texture }], hands: [] }).meshes[0]
        .texture
    ).toEqual(texture)
  })

  it('enriches mesh relative model', () => {
    const kind = faker.lorem.word()
    const file = faker.system.commonFileName('png')
    expect(
      enrichAssets({ kind, meshes: [{ id: 1, file }], hands: [] }).meshes[0]
        .file
    ).toEqual(`/${kind}/models/${file}`)
  })

  it('does not enrich mesh absolute model', () => {
    const kind = faker.lorem.word()
    const file = faker.system.filePath()
    expect(
      enrichAssets({ kind, meshes: [{ id: 1, file }], hands: [] }).meshes[0]
        .file
    ).toEqual(file)
  })

  it('enriches mesh relative front image', () => {
    const kind = faker.lorem.word()
    const frontImage = faker.system.commonFileName('png')
    expect(
      enrichAssets({
        kind,
        meshes: [{ id: 1, detailable: { frontImage } }],
        hands: []
      }).meshes[0].detailable.frontImage
    ).toEqual(`/${kind}/images/${frontImage}`)
  })

  it('does not enrich mesh absolute front image', () => {
    const kind = faker.lorem.word()
    const frontImage = faker.system.filePath()
    expect(
      enrichAssets({
        kind,
        meshes: [{ id: 1, detailable: { frontImage } }],
        hands: []
      }).meshes[0].detailable.frontImage
    ).toEqual(frontImage)
  })

  it('enriches mesh relative back image', () => {
    const kind = faker.lorem.word()
    const backImage = faker.system.commonFileName('png')
    expect(
      enrichAssets({
        kind,
        meshes: [{ id: 1, detailable: { backImage } }],
        hands: []
      }).meshes[0].detailable.backImage
    ).toEqual(`/${kind}/images/${backImage}`)
  })

  it('does not enrich mesh absolute front image', () => {
    const kind = faker.lorem.word()
    const backImage = faker.system.filePath()
    expect(
      enrichAssets({
        kind,
        meshes: [{ id: 1, detailable: { backImage } }],
        hands: []
      }).meshes[0].detailable.backImage
    ).toEqual(backImage)
  })

  it('enriches all mesh relative assets', () => {
    const kind = faker.lorem.word()
    const texture = faker.system.commonFileName('png')
    const file = faker.system.commonFileName('png')
    const frontImage = faker.system.commonFileName('png')
    const backImage = faker.system.commonFileName('png')
    const {
      hands: [
        {
          meshes: [mesh]
        }
      ]
    } = enrichAssets({
      kind,
      meshes: [],
      hands: [
        {
          meshes: [
            { id: 1, texture, file, detailable: { frontImage, backImage } }
          ]
        }
      ]
    })
    expect(mesh.texture).toEqual(`/${kind}/textures/${texture}`)
    expect(mesh.file).toEqual(`/${kind}/models/${file}`)
    expect(mesh.detailable.frontImage).toEqual(`/${kind}/images/${frontImage}`)
    expect(mesh.detailable.backImage).toEqual(`/${kind}/images/${backImage}`)
  })
})

describe('draw()', () => {
  let game

  beforeEach(() => {
    game = {
      hands: [],
      meshes: [
        { id: 'A' },
        {
          id: 'B',
          anchorable: { anchors: [{ id: 'discard', snappedId: 'C' }] }
        },
        { id: 'C', stackable: { stackIds: ['A', 'E', 'D'] } },
        { id: 'D' },
        { id: 'E' }
      ]
    }
  })

  it('draws one mesh from a stack', () => {
    const { meshes } = game
    expect(draw('C', 1, game.meshes)).toEqual([meshes[3]])
    expect(meshes[2].stackable.stackIds).toEqual(['A', 'E'])
  })

  it('draws several meshes from a stack', () => {
    const { meshes } = game
    expect(draw('C', 2, meshes)).toEqual([meshes[3], meshes[4]])
    expect(meshes[2].stackable.stackIds).toEqual(['A'])
  })

  it('can deplete a stack', () => {
    const { meshes } = game
    expect(draw('C', 10, meshes)).toEqual([meshes[3], meshes[4], meshes[0]])
    expect(meshes[2].stackable.stackIds).toEqual([])
  })

  it('does nothing on unstackable meshes', () => {
    expect(draw('A', 1, game.meshes)).toEqual([])
  })

  it('does nothing on unknown meshes', () => {
    expect(draw('K', 1, game.meshes)).toEqual([])
  })
})

describe('drawInHand()', () => {
  const playerId = faker.string.uuid()
  let game

  beforeEach(() => {
    game = {
      hands: [],
      meshes: [
        { id: 'A' },
        {
          id: 'B',
          anchorable: { anchors: [{ id: 'discard', snappedId: 'C' }] }
        },
        { id: 'C', stackable: { stackIds: ['A', 'E', 'D'] } },
        { id: 'D' },
        { id: 'E' }
      ]
    }
  })

  it('throws error on unknown anchor', () => {
    expect(() => drawInHand(game, { playerId, fromAnchor: 'unknown' })).toThrow(
      `no anchor with id 'unknown'`
    )
  })

  it('draws one mesh into a new hand', () => {
    drawInHand(game, { playerId, fromAnchor: 'discard' })
    expect(game).toEqual({
      hands: [{ playerId, meshes: [{ id: 'D' }] }],
      meshes: [
        { id: 'A' },
        {
          id: 'B',
          anchorable: { anchors: [{ id: 'discard', snappedId: 'C' }] }
        },
        { id: 'C', stackable: { stackIds: ['A', 'E'] } },
        { id: 'E' }
      ]
    })
  })

  it('draws multiple meshes into a new hand', () => {
    const props = { foo: 'bar' }
    drawInHand(game, { playerId, count: 2, fromAnchor: 'discard', props })
    expect(game).toEqual({
      hands: [
        {
          playerId,
          meshes: [
            { id: 'D', ...props },
            { id: 'E', ...props }
          ]
        }
      ],
      meshes: [
        { id: 'A' },
        {
          id: 'B',
          anchorable: { anchors: [{ id: 'discard', snappedId: 'C' }] }
        },
        { id: 'C', stackable: { stackIds: ['A'] } }
      ]
    })
  })

  it('draws until depletion into a new hand', () => {
    drawInHand(game, { playerId, count: 10, fromAnchor: 'discard' })
    expect(game).toEqual({
      hands: [
        {
          playerId,
          meshes: [
            { id: 'D' },
            { id: 'E' },
            { id: 'A' },
            { id: 'C', stackable: { stackIds: [] } }
          ]
        }
      ],
      meshes: [
        {
          id: 'B',
          anchorable: { anchors: [{ id: 'discard', snappedId: null }] }
        }
      ]
    })
  })

  it('draws nothing from empty anchor', () => {
    game.meshes[1].anchorable.anchors[0].snappedId = null
    drawInHand(game, { playerId, count: 2, fromAnchor: 'discard' })
    expect(game).toEqual(
      (game = {
        hands: [{ playerId, meshes: [] }],
        meshes: [
          { id: 'A' },
          {
            id: 'B',
            anchorable: { anchors: [{ id: 'discard', snappedId: null }] }
          },
          { id: 'C', stackable: { stackIds: ['A', 'E', 'D'] } },
          { id: 'D' },
          { id: 'E' }
        ]
      })
    )
  })
})

describe('findMesh()', () => {
  const meshes = Array.from({ length: 10 }, () => ({
    id: faker.string.uuid()
  }))

  it('returns existing meshes', () => {
    expect(findMesh(meshes[5].id, meshes)).toEqual(meshes[5])
    expect(findMesh(meshes[8].id, meshes)).toEqual(meshes[8])
  })

  it('returns null for unknown ids', () => {
    expect(findMesh(faker.string.uuid(), meshes)).toBeNull()
    expect(findMesh(meshes[0].id, [])).toBeNull()
    expect(findMesh(meshes[0].id)).toBeNull()
  })
})

describe('findOrCreateHand()', () => {
  it('finds existing hand', () => {
    const playerId1 = faker.string.uuid()
    const playerId2 = faker.string.uuid()

    const game = {
      hands: [
        { playerId: playerId1, meshes: [{ id: 'A' }] },
        { playerId: playerId2, meshes: [{ id: 'B' }] }
      ]
    }
    expect(findOrCreateHand(game, playerId1)).toEqual(game.hands[0])
    expect(findOrCreateHand(game, playerId2)).toEqual(game.hands[1])
  })

  it('creates new hand', () => {
    const playerId1 = faker.string.uuid()
    const playerId2 = faker.string.uuid()

    const game = {
      hands: [{ playerId: playerId1, meshes: [{ id: 'A' }] }]
    }
    const created = { playerId: playerId2, meshes: [] }
    expect(findOrCreateHand(game, playerId1)).toEqual(game.hands[0])
    expect(findOrCreateHand(game, playerId2)).toEqual(created)
    expect(game.hands[1]).toEqual(created)
  })
})

describe('findAnchor()', () => {
  const anchors = Array.from({ length: 10 }, () => ({
    id: faker.string.uuid()
  }))

  const meshes = [
    { id: 'mesh0' },
    { id: 'mesh1', anchorable: { anchors: anchors.slice(0, 3) } },
    { id: 'mesh2', anchorable: { anchors: [] } },
    { id: 'mesh3', anchorable: { anchors: anchors.slice(3, 6) } },
    { id: 'mesh4', anchorable: { anchors: anchors.slice(6) } }
  ]

  it('returns null on unknown anchor', () => {
    expect(findAnchor(faker.string.uuid(), meshes)).toBeNull()
    expect(findAnchor(anchors[0].id, [])).toBeNull()
    expect(findAnchor(anchors[0].id)).toBeNull()
  })

  it('returns existing anchor', () => {
    expect(findAnchor(anchors[0].id, meshes)).toEqual(anchors[0])
    expect(findAnchor(anchors[4].id, meshes)).toEqual(anchors[4])
    expect(findAnchor(anchors[7].id, meshes)).toEqual(anchors[7])
  })

  it('returns existing, deep, anchor', () => {
    const meshes = [
      { id: 'mesh0', anchorable: { anchors: [{ id: 'bottom' }] } },
      {
        id: 'mesh1',
        anchorable: { anchors: [{ id: 'bottom', snappedId: 'mesh3' }] }
      },
      {
        id: 'mesh2',
        anchorable: { anchors: [{ id: 'start', snappedId: 'mesh1' }] }
      },
      {
        id: 'mesh3',
        anchorable: { anchors: [{ id: 'bottom', snappedId: 'mesh0' }] }
      }
    ]
    expect(findAnchor('start.bottom', meshes)).toEqual(
      meshes[1].anchorable.anchors[0]
    )
    expect(findAnchor('start.bottom.bottom', meshes)).toEqual(
      meshes[3].anchorable.anchors[0]
    )
    expect(findAnchor('start.bottom.bottom.bottom', meshes)).toEqual(
      meshes[0].anchorable.anchors[0]
    )
    expect(findAnchor('bottom', meshes)).toEqual(
      meshes[0].anchorable.anchors[0]
    )
  })
})

describe('snapTo()', () => {
  let meshes
  beforeEach(() => {
    meshes = [
      { id: 'mesh0' },
      { id: 'mesh1', anchorable: { anchors: [{ id: 'anchor1' }] } },
      {
        id: 'mesh2',
        anchorable: { anchors: [{ id: 'anchor2' }, { id: 'anchor3' }] }
      },
      { id: 'mesh3' }
    ]
  })

  it('snaps a mesh to an existing anchor', () => {
    expect(snapTo('anchor3', meshes[0], meshes)).toBe(true)
    expect(meshes[2]).toEqual({
      id: 'mesh2',
      anchorable: {
        anchors: [{ id: 'anchor2' }, { id: 'anchor3', snappedId: 'mesh0' }]
      }
    })
  })

  it('stacks a mesh if anchor is in use', () => {
    meshes[0].stackable = {}
    meshes[1].stackable = {}
    expect(snapTo('anchor2', meshes[0], meshes)).toBe(true)
    expect(snapTo('anchor2', meshes[1], meshes)).toBe(true)
    expect(meshes[2]).toEqual({
      id: 'mesh2',
      anchorable: {
        anchors: [{ id: 'anchor2', snappedId: 'mesh0' }, { id: 'anchor3' }]
      }
    })
    expect(meshes[0]).toEqual({
      id: 'mesh0',
      stackable: { stackIds: ['mesh1'] }
    })
  })

  it('ignores unstackable mesh on an anchor in use', () => {
    meshes[0].stackable = {}
    expect(snapTo('anchor2', meshes[0], meshes)).toBe(true)
    const state = cloneAsJSON(meshes)
    expect(snapTo('anchor2', meshes[1], meshes)).toBe(false)
    expect(state).toEqual(meshes)
  })

  it('ignores mesh on an anchor in use with unstackable mesh', () => {
    expect(snapTo('anchor2', meshes[0], meshes)).toBe(true)
    meshes[1].stackable = {}
    const state = cloneAsJSON(meshes)
    expect(snapTo('anchor2', meshes[1], meshes)).toBe(false)
    expect(state).toEqual(meshes)
  })

  it('ignores unknown anchor', () => {
    const state = cloneAsJSON(meshes)
    expect(snapTo('anchor10', meshes[0], meshes)).toBe(false)
    expect(state).toEqual(meshes)
  })

  it('ignores unknown mesh', () => {
    const state = cloneAsJSON(meshes)
    expect(snapTo('anchor1', null, meshes)).toBe(false)
    expect(state).toEqual(meshes)
  })
})

describe('unsnap()', () => {
  let meshes

  beforeEach(() => {
    meshes = [
      {
        id: 'mesh1',
        anchorable: {
          anchors: [{ id: 'anchor1', snappedId: 'mesh2' }, { id: 'anchor2' }]
        }
      },
      {
        id: 'mesh2',
        anchorable: {
          anchors: [
            { id: 'anchor3', snappedId: 'mesh3' },
            { id: 'anchor4', snappedId: 'unknown' }
          ]
        }
      },
      {
        id: 'mesh3'
      }
    ]
  })

  it('returns nothing on unknown anchor', () => {
    expect(unsnap('unknown', meshes)).toBeNull()
  })

  it('returns nothing on anchor with no snapped mesh', () => {
    expect(unsnap('anchor2', meshes)).toBeNull()
  })
  it('returns nothing on anchor with unknown snapped mesh', () => {
    expect(unsnap('anchor4', meshes)).toBeNull()
  })

  it('returns mesh and unsnapps it', () => {
    expect(unsnap('anchor3', meshes)).toEqual(meshes[2])
    expect(meshes[1].anchorable.anchors).toEqual([
      { id: 'anchor3', snappedId: null },
      { id: 'anchor4', snappedId: 'unknown' }
    ])
  })
})

describe('stackMeshes()', () => {
  let meshes

  beforeEach(() => {
    meshes = [
      { id: 'mesh0' },
      { id: 'mesh1' },
      { id: 'mesh2' },
      { id: 'mesh3' },
      { id: 'mesh4' }
    ]
  })

  it('stacks a list of meshes in order', () => {
    stackMeshes(meshes)
    expect(meshes).toEqual([
      {
        id: 'mesh0',
        stackable: { stackIds: ['mesh1', 'mesh2', 'mesh3', 'mesh4'] }
      },
      ...meshes.slice(1)
    ])
  })

  it('stacks on top of an existing stack', () => {
    meshes[0].stackable = { stackIds: ['mesh4', 'mesh3'] }
    stackMeshes([meshes[0], ...meshes.slice(1, 3)])
    expect(meshes).toEqual([
      {
        id: 'mesh0',
        stackable: { stackIds: ['mesh4', 'mesh3', 'mesh1', 'mesh2'] }
      },
      ...meshes.slice(1)
    ])
  })

  it('do nothing on a stack of one', () => {
    stackMeshes(meshes.slice(0, 1))
    expect(meshes).toEqual([{ id: 'mesh0' }, ...meshes.slice(1)])
  })
})

describe('decrement()', () => {
  it('ignores non quantifiable meshes', () => {
    const mesh = { id: 'mesh1' }
    expect(decrement(mesh)).toBeUndefined()
    expect(mesh).toEqual({ id: 'mesh1' })
  })

  it('ignores quantifiable mesh of 1', () => {
    const mesh = { id: 'mesh1', quantifiable: { quantity: 1 } }
    expect(decrement(mesh)).toBeUndefined()
    expect(mesh).toEqual({ id: 'mesh1', quantifiable: { quantity: 1 } })
  })

  it('decrements a quantifiable mesh by 1', () => {
    const foo = faker.lorem.words()
    const mesh = { id: 'mesh1', foo, quantifiable: { quantity: 6 } }
    expect(decrement(mesh)).toEqual({
      id: expect.stringMatching(/^mesh1-/),
      foo,
      quantifiable: { quantity: 1 }
    })
    expect(mesh).toEqual({ id: 'mesh1', foo, quantifiable: { quantity: 5 } })
  })
})

describe('buildCameraPosition()', () => {
  it('applies all defaults', () => {
    const playerId = faker.string.uuid()
    expect(buildCameraPosition({ playerId })).toEqual({
      playerId,
      index: 0,
      target: [0, 0, 0],
      alpha: (Math.PI * 3) / 2,
      beta: Math.PI / 8,
      elevation: 35,
      hash: '0-0-0-4.71238898038469-0.39269908169872414-35'
    })
  })

  it('throws on missing player id', () => {
    expect(() => buildCameraPosition({})).toThrow(
      'camera position requires playerId'
    )
  })

  it('uses provided data and computes hash', () => {
    const playerId = faker.string.uuid()
    const index = faker.number.int()
    const alpha = faker.number.int()
    const beta = faker.number.int()
    const elevation = faker.number.int()
    const target = [faker.number.int(), faker.number.int(), faker.number.int()]
    expect(
      buildCameraPosition({ playerId, index, alpha, beta, elevation, target })
    ).toEqual({
      playerId,
      index,
      target,
      alpha,
      beta,
      elevation,
      hash: `${target[0]}-${target[1]}-${target[2]}-${alpha}-${beta}-${elevation}`
    })
  })
})

describe('getParameterSchema()', () => {
  const askForParameters = vi.fn()
  const kind = faker.lorem.word()
  const game = { kind, meshes: [{ id: faker.string.uuid() }] }
  const player = { id: faker.string.uuid(), name: faker.person.fullName() }

  beforeEach(vi.resetAllMocks)

  it('enriches game data with parameters', async () => {
    const schema = {
      type: 'object',
      properties: {
        side: {
          type: 'string',
          enum: ['white', 'black']
        }
      }
    }
    askForParameters.mockResolvedValue(schema)
    expect(
      await getParameterSchema({
        descriptor: { askForParameters },
        game,
        player
      })
    ).toEqual({ ...game, schema })
    expect(askForParameters).toHaveBeenCalledWith({ game, player })
  })

  it('handles missing askForParameters()', async () => {
    expect(
      await getParameterSchema({ descriptor: {}, game, player })
    ).toBeNull()
  })

  it('handles no schema', async () => {
    askForParameters.mockResolvedValue(null)
    expect(
      await getParameterSchema({
        descriptor: { askForParameters },
        game,
        player
      })
    ).toBeNull()
    expect(askForParameters).toHaveBeenCalledWith({ game, player })
  })

  it('enriches image metadatas', async () => {
    const { schema } = await getParameterSchema({
      descriptor: {
        askForParameters: () => ({
          type: 'object',
          properties: {
            suite: {
              type: 'string',
              enum: ['clubs', 'spades'],
              metadata: {
                images: {
                  clubs: 'clubs.png',
                  spades: 'spades.png'
                }
              }
            },
            side: {
              type: 'string',
              enum: ['white', 'black']
            }
          }
        })
      },
      game,
      player
    })
    expect(schema.properties.suite.metadata.images).toEqual({
      clubs: `/${kind}/images/clubs.png`,
      spades: `/${kind}/images/spades.png`
    })
  })

  it('does not enrich image absolute metadata', async () => {
    const { schema } = await getParameterSchema({
      descriptor: {
        askForParameters: () => ({
          type: 'object',
          properties: {
            suite: {
              type: 'string',
              enum: ['clubs', 'spades'],
              metadata: {
                images: {
                  clubs: '/clubs.png',
                  spades: '#spades.png'
                }
              }
            }
          }
        })
      },
      game,
      player
    })
    expect(schema.properties.suite.metadata.images).toEqual({
      clubs: `/clubs.png`,
      spades: `#spades.png`
    })
  })
})

describe('findAvailableValues()', () => {
  const colors = ['red', 'green', 'blue']

  it('returns all possible values when there are no preferences', () => {
    expect(findAvailableValues([], 'color', colors)).toEqual(colors)
  })

  it('returns nothing when all possible values were used', () => {
    expect(
      findAvailableValues(
        colors.map(color => ({ color })),
        'color',
        colors
      )
    ).toEqual([])
  })

  it('returns available values', () => {
    expect(
      findAvailableValues(
        [
          { color: 'red' },
          { color: 'lime' },
          { color: 'azure' },
          { color: 'blue' }
        ],
        'color',
        colors
      )
    ).toEqual(['green'])
  })

  it('ignores unknown preference name', () => {
    expect(
      findAvailableValues(
        [
          { color: 'red' },
          { color: 'lime' },
          { color: 'azure' },
          { color: 'blue' }
        ],
        'unknown',
        colors
      )
    ).toEqual(colors)
  })
})

function expectStackedOnSlot(meshes, slot, count = slot.count) {
  const stack = meshes.find(
    ({ stackable }) => stackable?.stackIds.length === count - 1
  )
  expect(stack).toBeDefined()
  const stackedMeshes = meshes.filter(
    ({ id }) => stack.stackable.stackIds.includes(id) || id === stack.id
  )
  expect(stackedMeshes).toHaveLength(count)
  expect(
    stackedMeshes.every(
      ({ x, y, z }) => x === slot.x && y === slot.y && z === slot.z
    )
  ).toBe(true)
  return stack
}

function expectSnappedByName(meshes, name, anchor) {
  const candidates = meshes.filter(mesh => name === mesh.name)
  expect(candidates).toHaveLength(1)
  expect(anchor.snappedId).toEqual(candidates[0].id)
}
