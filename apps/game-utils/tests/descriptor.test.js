// @ts-check
import { faker } from '@faker-js/faker'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMeshes,
  enrichAssets,
  reportReusedIds
} from '../src/descriptor.js'
import {
  expectSnappedByName,
  expectStackedOnSlot,
  makeGame
} from './test-utils.js'

describe('createMeshes()', () => {
  it('throws on invalid descriptor', async () => {
    const kind = faker.company.name()
    // @ts-expect-error
    await expect(createMeshes(kind)).rejects.toThrow(
      `Game ${kind} does not export a build() function`
    )
    await expect(createMeshes(kind, {})).rejects.toThrow(
      `Game ${kind} does not export a build() function`
    )
  })

  it('ignores missing mesh', async () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      build: () => ({
        meshes: ids.map(id => ({
          id,
          texture: '',
          shape: /** @type {const} */ ('box')
        })),
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
        meshes: ids.map(id => ({
          id,
          texture: '',
          shape: /** @type {const} */ ('box')
        })),
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
        meshes: ids.map(id => ({
          id,
          texture: '',
          shape: /** @type {const} */ ('box')
        })),
        bags: new Map([['cards', ids]])
      })
    }
    expect(await createMeshes('cards', descriptor)).toEqual([])
  })

  it('ignores no bags', async () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      build: () => ({
        meshes: ids.map(id => ({
          id,
          texture: '',
          shape: /** @type {const} */ ('box')
        })),
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
        meshes: ids.map(id => ({
          id,
          texture: '',
          shape: /** @type {const} */ ('box')
        })),
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
        meshes: ids.map(id => ({
          id,
          texture: '',
          shape: /** @type {const} */ ('box')
        })),
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
          ...ids.map(id => ({
            id,
            texture: '',
            shape: /** @type {const} */ ('box')
          })),
          {
            id: boardId,
            texture: '',
            shape: /** @type {const} */ ('box'),
            anchorable: { anchors: [{ id: 'anchor' }] }
          }
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
      expect(board?.anchorable?.anchors?.[0]?.snappedId).toEqual(stackId)
    })
  })

  describe('given a descriptor with anchorable board', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const initialMeshes = [
      {
        id: 'board',
        texture: '',
        shape: /** @type {const} */ ('box'),
        anchorable: {
          anchors: [{ id: 'first' }, { id: 'second' }, { id: 'third' }]
        }
      },
      ...ids.map(id => ({
        id,
        texture: '',
        shape: /** @type {const} */ ('box'),
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

      expectSnappedByName(
        meshes,
        slots[0].name,
        board?.anchorable?.anchors?.[0]
      )
      expect(board?.anchorable?.anchors?.[1].snappedId).toBeUndefined()
      expectSnappedByName(
        meshes,
        slots[1].name,
        board?.anchorable?.anchors?.[2]
      )
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

      expect(board?.anchorable?.anchors?.[0].snappedId).toBeUndefined()
      expectSnappedByName(meshes, 'base', board?.anchorable?.anchors?.[1])
      expect(board?.anchorable?.anchors?.[2].snappedId).toBeUndefined()

      const base = meshes.find(mesh => 'name' in mesh && mesh.name === 'base')
      expectSnappedByName(meshes, 'top', base?.anchorable?.anchors?.[0])
      expectSnappedByName(meshes, 'bottom', base?.anchorable?.anchors?.[1])
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

      expect(board?.anchorable?.anchors?.[0].snappedId).toBeUndefined()
      expectSnappedByName(meshes, 'base', board?.anchorable?.anchors?.[1])
      expect(board?.anchorable?.anchors?.[2].snappedId).toBeUndefined()

      const base = meshes.find(mesh => 'name' in mesh && mesh.name === 'base')
      expectSnappedByName(meshes, 'first', base?.anchorable?.anchors?.[0])
      expect(base?.anchorable?.anchors?.[1].snappedId).toBeUndefined()

      const first = meshes.find(mesh => 'name' in mesh && mesh.name === 'first')
      expectSnappedByName(meshes, 'second', first?.anchorable?.anchors?.[0])
      expect(first?.anchorable?.anchors?.[1].snappedId).toBeUndefined()

      const second = meshes.find(
        mesh => 'name' in mesh && mesh.name === 'second'
      )
      expectSnappedByName(meshes, 'third', second?.anchorable?.anchors?.[1])
      expect(second?.anchorable?.anchors?.[0].snappedId).toBeUndefined()

      const third = meshes.find(mesh => 'name' in mesh && mesh.name === 'third')
      expect(third?.anchorable?.anchors?.[0].snappedId).toBeUndefined()
      expect(third?.anchorable?.anchors?.[1].snappedId).toBeUndefined()
    })

    it('can stack on top of an anchor', async () => {
      const slots = [
        { bagId: 'cards', anchorId: 'second', count: 3, name: 'base' }
      ]
      const meshes = await createMeshes('cards', {
        build: () => ({
          meshes: [
            initialMeshes[0],
            ...ids.map(id => ({
              id,
              texture: '',
              shape: /** @type {const} */ ('box')
            }))
          ],
          slots,
          bags
        })
      })

      const board = meshes.find(({ id }) => id === 'board')
      const snapped = meshes.filter(
        mesh => 'name' in mesh && mesh.name === 'base'
      )
      expect(board).toBeDefined()
      expect(snapped).toHaveLength(3)
      expect(board?.anchorable?.anchors?.[0].snappedId).toBeUndefined()
      const base = snapped.filter(mesh => mesh.stackable)
      expect(base).toHaveLength(1)
      expect(base?.[0]?.stackable?.stackIds).toEqual(
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
          meshes: [
            ...ids.map(id => ({
              id,
              texture: '',
              shape: /** @type {const} */ ('box')
            })),
            initialMeshes[0]
          ],
          slots,
          bags
        })
      })

      const board = meshes.find(({ id }) => id === 'board')
      const base = meshes.find(mesh => 'name' in mesh && mesh.name === 'base')
      expect(board).toBeDefined()
      expect(base).toBeDefined()
      expect(base?.x).toBeUndefined()
      expect(board?.anchorable?.anchors?.[0].snappedId).toBeUndefined()
      expectSnappedByName(meshes, 'base', board?.anchorable?.anchors?.[1])
      expect(board?.anchorable?.anchors?.[2].snappedId).toBeUndefined()
      expect(
        meshes
          .filter(
            mesh =>
              'name' in mesh && mesh.name !== 'base' && mesh.id !== 'board'
          )
          .every(({ x }) => x === 1)
      ).toBe(true)
    })
  })

  describe('given a descriptor with multiple slots on the same bag', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      build: () => ({
        meshes: ids.map(id => ({
          id,
          texture: '',
          shape: /** @type {const} */ ('box')
        })),
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
        meshes.filter(({ stackable }) => stackable?.stackIds?.length === 1)
      ).toHaveLength(1)
      expect(meshes.filter(({ x }) => x === 10)).toHaveLength(2)
      expect(meshes.filter(({ x }) => x === 5)).toHaveLength(1)
      expect(
        meshes.filter(({ stackable }) => stackable?.stackIds?.length === 6)
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
      enrichAssets(
        makeGame({
          kind,
          meshes: [{ id: '1', shape: 'box', texture }]
        })
      ).meshes?.[0].texture
    ).toEqual(`/${kind}/textures/${texture}`)
  })

  it('does not enrich mesh absolute texture', () => {
    const kind = faker.lorem.word()
    const texture = faker.system.filePath()
    expect(
      enrichAssets(
        makeGame({
          kind,
          meshes: [{ id: '1', shape: 'box', texture }]
        })
      ).meshes?.[0].texture
    ).toEqual(texture)
  })

  it('does not enrich mesh colored texture', () => {
    const kind = faker.lorem.word()
    const texture = faker.internet.color()
    expect(
      enrichAssets(
        makeGame({
          kind,
          meshes: [{ id: '1', shape: 'box', texture }]
        })
      ).meshes?.[0].texture
    ).toEqual(texture)
  })

  it('enriches mesh relative model', () => {
    const kind = faker.lorem.word()
    const file = faker.system.commonFileName('png')
    expect(
      enrichAssets(
        makeGame({
          kind,
          meshes: [{ id: '1', shape: 'box', texture: '', file }]
        })
      ).meshes?.[0].file
    ).toEqual(`/${kind}/models/${file}`)
  })

  it('does not enrich mesh absolute model', () => {
    const kind = faker.lorem.word()
    const file = faker.system.filePath()
    expect(
      enrichAssets(
        makeGame({
          kind,
          meshes: [{ id: '1', shape: 'box', texture: '', file }]
        })
      ).meshes?.[0].file
    ).toEqual(file)
  })

  it('enriches mesh relative front image', () => {
    const kind = faker.lorem.word()
    const frontImage = faker.system.commonFileName('png')
    expect(
      enrichAssets(
        makeGame({
          kind,
          meshes: [
            { id: '1', shape: 'box', texture: '', detailable: { frontImage } }
          ]
        })
      ).meshes?.[0].detailable?.frontImage
    ).toEqual(`/${kind}/images/${frontImage}`)
  })

  it('does not enrich mesh absolute front image', () => {
    const kind = faker.lorem.word()
    const frontImage = faker.system.filePath()
    expect(
      enrichAssets(
        makeGame({
          kind,
          meshes: [
            { id: '1', shape: 'box', texture: '', detailable: { frontImage } }
          ]
        })
      ).meshes?.[0].detailable?.frontImage
    ).toEqual(frontImage)
  })

  it('enriches mesh relative back image', () => {
    const kind = faker.lorem.word()
    const backImage = faker.system.commonFileName('png')
    expect(
      enrichAssets(
        makeGame({
          kind,
          meshes: [
            {
              id: '1',
              shape: 'box',
              texture: '',
              detailable: { frontImage: '', backImage }
            }
          ]
        })
      ).meshes?.[0].detailable?.backImage
    ).toEqual(`/${kind}/images/${backImage}`)
  })

  it('does not enrich mesh absolute front image', () => {
    const kind = faker.lorem.word()
    const frontImage = faker.system.filePath()
    expect(
      enrichAssets(
        makeGame({
          kind,
          meshes: [
            { id: '1', shape: 'box', texture: '', detailable: { frontImage } }
          ]
        })
      ).meshes?.[0]?.detailable?.frontImage
    ).toEqual(frontImage)
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
    } = /** @type {import('@tabulous/types').StartedGame} */ (
      enrichAssets(
        makeGame({
          kind,
          hands: [
            {
              playerId: 'foo',
              meshes: [
                {
                  id: '1',
                  shape: 'box',
                  texture,
                  file,
                  detailable: { frontImage, backImage }
                }
              ]
            }
          ]
        })
      )
    )
    expect(mesh.texture).toEqual(`/${kind}/textures/${texture}`)
    expect(mesh.file).toEqual(`/${kind}/models/${file}`)
    expect(mesh.detailable?.frontImage).toEqual(`/${kind}/images/${frontImage}`)
    expect(mesh.detailable?.backImage).toEqual(`/${kind}/images/${backImage}`)
  })
})

describe('reportReusedIds()', () => {
  const warn = vi.spyOn(console, 'warn')
  const game = makeGame({
    name: 'test-game'
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('does not report valid descriptor', () => {
    reportReusedIds({
      ...game,
      meshes: [
        { id: 'box1', shape: 'box', texture: '' },
        { id: 'box2', shape: 'box', texture: '' }
      ],
      hands: [
        {
          playerId: 'a',
          meshes: [
            { id: 'box3', shape: 'box', texture: '' },
            { id: 'box4', shape: 'box', texture: '' }
          ]
        },
        {
          playerId: 'b',
          meshes: [{ id: 'box5', shape: 'box', texture: '' }]
        }
      ]
    })
    expect(warn).not.toHaveBeenCalled()
  })

  it('reports reused mesh ids', () => {
    reportReusedIds({
      ...game,
      meshes: [
        { id: 'box1', shape: 'box', texture: '' },
        { id: 'box2', shape: 'box', texture: '' },
        { id: 'box3', shape: 'box', texture: '' },
        { id: 'box1', shape: 'box', texture: '' }
      ],
      hands: [
        {
          playerId: 'a',
          meshes: [{ id: 'box3', shape: 'box', texture: '' }]
        }
      ]
    })
    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('box1, box3'))
  })

  it('reports reused anchor ids', () => {
    reportReusedIds({
      ...game,
      meshes: [
        {
          id: 'box1',
          shape: 'box',
          texture: '',
          anchorable: { anchors: [{ id: 'anchor1' }] }
        },
        { id: 'box2', shape: 'box', texture: '' }
      ],
      hands: [
        {
          playerId: 'a',
          meshes: [
            {
              id: 'box3',
              shape: 'box',
              texture: '',
              anchorable: { anchors: [{ id: 'anchor1' }, { id: 'box2' }] }
            }
          ]
        }
      ]
    })
    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('anchor1, box2'))
  })
})
