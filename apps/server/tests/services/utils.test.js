import faker from 'faker'
import { createMeshes } from '../../src/services/utils.js'

describe('createMeshes()', () => {
  it('ignores missing mesh', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      meshes: ids.map(id => ({ id })),
      bags: new Map([['cards', ['card-null', 'card-1', 'card', 'card-2']]]),
      slots: [{ bagId: 'cards', x: 1, y: 2, z: 3 }]
    }
    expect(createMeshes('cards', descriptor)).toEqual(
      expect.arrayContaining(descriptor.meshes.map(expect.objectContaining))
    )
  })

  it('ignores missing bags', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      meshes: ids.map(id => ({ id })),
      bags: new Map([['cards', ids]]),
      slots: [{ bagId: 'unknown', x: 1, y: 2, z: 3 }]
    }
    expect(createMeshes('cards', descriptor)).toEqual(descriptor.meshes)
  })

  it('ignores missing slots', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      meshes: ids.map(id => ({ id })),
      bags: new Map([['cards', ids]])
    }
    expect(createMeshes('cards', descriptor)).toEqual(descriptor.meshes)
  })

  it('ignores no bags', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      meshes: ids.map(id => ({ id })),
      slots: [{ bagId: 'unknown', x: 1, y: 2, z: 3 }]
    }
    expect(createMeshes('cards', descriptor)).toEqual(descriptor.meshes)
  })

  it('enriches mesh relative texture', () => {
    const gameId = faker.lorem.word()
    const texture = faker.system.commonFileName('png')
    const descriptor = { meshes: [{ id: 1, texture }] }
    expect(createMeshes(gameId, descriptor)[0].texture).toEqual(
      `/games/${gameId}/textures/${texture}`
    )
  })

  it('does not enrich mesh absolute texture', () => {
    const gameId = faker.lorem.word()
    const texture = faker.system.filePath()
    const descriptor = { meshes: [{ id: 1, texture }] }
    expect(createMeshes(gameId, descriptor)[0].texture).toEqual(texture)
  })

  it('does not enrich mesh colored texture', () => {
    const gameId = faker.lorem.word()
    const texture = faker.internet.color()
    const descriptor = { meshes: [{ id: 1, texture }] }
    expect(createMeshes(gameId, descriptor)[0].texture).toEqual(texture)
  })

  it('enriches mesh relative model', () => {
    const gameId = faker.lorem.word()
    const file = faker.system.commonFileName('png')
    const descriptor = { meshes: [{ id: 1, file }] }
    expect(createMeshes(gameId, descriptor)[0].file).toEqual(
      `/games/${gameId}/models/${file}`
    )
  })

  it('does not enrich mesh absolute model', () => {
    const gameId = faker.lorem.word()
    const file = faker.system.filePath()
    const descriptor = { meshes: [{ id: 1, file }] }
    expect(createMeshes(gameId, descriptor)[0].file).toEqual(file)
  })

  it('enriches mesh relative front image', () => {
    const gameId = faker.lorem.word()
    const frontImage = faker.system.commonFileName('png')
    const descriptor = { meshes: [{ id: 1, detailable: { frontImage } }] }
    expect(createMeshes(gameId, descriptor)[0].detailable.frontImage).toEqual(
      `/games/${gameId}/images/${frontImage}`
    )
  })

  it('does not enrich mesh absolute front image', () => {
    const gameId = faker.lorem.word()
    const frontImage = faker.system.filePath()
    const descriptor = { meshes: [{ id: 1, detailable: { frontImage } }] }
    expect(createMeshes(gameId, descriptor)[0].detailable.frontImage).toEqual(
      frontImage
    )
  })

  it('enriches mesh relative back image', () => {
    const gameId = faker.lorem.word()
    const backImage = faker.system.commonFileName('png')
    const descriptor = { meshes: [{ id: 1, detailable: { backImage } }] }
    expect(createMeshes(gameId, descriptor)[0].detailable.backImage).toEqual(
      `/games/${gameId}/images/${backImage}`
    )
  })

  it('does not enrich mesh absolute front image', () => {
    const gameId = faker.lorem.word()
    const backImage = faker.system.filePath()
    const descriptor = { meshes: [{ id: 1, detailable: { backImage } }] }
    expect(createMeshes(gameId, descriptor)[0].detailable.backImage).toEqual(
      backImage
    )
  })

  it('enriches all mesh relative assets', () => {
    const gameId = faker.lorem.word()
    const texture = faker.system.commonFileName('png')
    const file = faker.system.commonFileName('png')
    const frontImage = faker.system.commonFileName('png')
    const backImage = faker.system.commonFileName('png')
    const descriptor = {
      meshes: [{ id: 1, texture, file, detailable: { frontImage, backImage } }]
    }
    const [mesh] = createMeshes(gameId, descriptor)
    expect(mesh.texture).toEqual(`/games/${gameId}/textures/${texture}`)
    expect(mesh.file).toEqual(`/games/${gameId}/models/${file}`)
    expect(mesh.detailable.frontImage).toEqual(
      `/games/${gameId}/images/${frontImage}`
    )
    expect(mesh.detailable.backImage).toEqual(
      `/games/${gameId}/images/${backImage}`
    )
  })

  describe('given a descriptor with single bag and slot', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      meshes: ids.map(id => ({ id })),
      bags: new Map([['cards', ids]]),
      slots: [{ bagId: 'cards', x: 1, y: 2, z: 3 }]
    }

    it('stacks meshes on slots with random order', () => {
      const meshes = createMeshes('cards', descriptor)
      expect(meshes).toEqual(
        expect.arrayContaining(descriptor.meshes.map(expect.objectContaining))
      )
      expect(meshes).not.toEqual(descriptor.meshes)
      expect(
        meshes.filter(({ stackable }) => stackable?.stackIds.length === 9)
      ).toHaveLength(1)
      const slot = descriptor.slots[0]
      expect(
        meshes.every(
          ({ x, y, z }) => x === slot.x && y === slot.y && z === slot.z
        )
      ).toBe(true)
    })

    it('applies different slot order on different games', () => {
      const meshes1 = createMeshes('cards', descriptor)
      const meshes2 = createMeshes('cards', descriptor)
      expect(meshes1).not.toEqual(descriptor.meshes)
      expect(meshes2).not.toEqual(descriptor.meshes)
      expect(meshes1).not.toEqual(meshes2)
    })
  })

  describe('given a descriptor with anchorable board', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      meshes: [
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
      ],
      bags: new Map([['cards', ids]])
    }

    it('snaps a random mesh on anchor', () => {
      const slots = [
        { bagId: 'cards', anchorId: 'first', count: 1, name: 'first' },
        { bagId: 'cards', anchorId: 'third', count: 1, name: 'third' }
      ]
      const meshes = createMeshes('cards', { ...descriptor, slots })
      const board = meshes.find(({ id }) => id === 'board')
      expect(board).toBeDefined()

      expectSnappedByName(meshes, slots[0].name, board.anchorable.anchors[0])
      expect(board.anchorable.anchors[1].snappedId).toBeUndefined()
      expectSnappedByName(meshes, slots[1].name, board.anchorable.anchors[2])
    })

    it('does not snap on unknown anchor', () => {
      const slots = [
        { bagId: 'cards', anchorId: 'first', count: 1, name: 'first' },
        { bagId: 'cards', anchorId: 'unknown', count: 1, name: 'unsnapped' }
      ]
      const meshes = createMeshes('cards', { ...descriptor, slots })
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

    it('snaps a random mesh on chained anchor', () => {
      const slots = [
        { bagId: 'cards', anchorId: 'second', count: 1, name: 'base' },
        { bagId: 'cards', anchorId: 'second.top', count: 1, name: 'top' },
        { bagId: 'cards', anchorId: 'second.bottom', count: 1, name: 'bottom' }
      ]
      const meshes = createMeshes('cards', { ...descriptor, slots })
      const board = meshes.find(({ id }) => id === 'board')
      expect(board).toBeDefined()

      expect(board.anchorable.anchors[0].snappedId).toBeUndefined()
      expectSnappedByName(meshes, 'base', board.anchorable.anchors[1])
      expect(board.anchorable.anchors[2].snappedId).toBeUndefined()

      const base = meshes.find(mesh => mesh.name === 'base')
      expectSnappedByName(meshes, 'top', base.anchorable.anchors[0])
      expectSnappedByName(meshes, 'bottom', base.anchorable.anchors[1])
    })

    it('snaps a random mesh on long chained anchor', () => {
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
      const meshes = createMeshes('cards', { ...descriptor, slots })
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

    it('can stack on top of an anchor', () => {
      const slots = [
        { bagId: 'cards', anchorId: 'second', count: 3, name: 'base' }
      ]
      const meshes = createMeshes('cards', {
        ...descriptor,
        meshes: [descriptor.meshes[0], ...ids.map(id => ({ id }))],
        slots
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

    it('can mix stack and anchors', () => {
      const slots = [
        { bagId: 'cards', anchorId: 'second', count: 1, name: 'base' },
        { bagId: 'cards', x: 1, z: 2 }
      ]
      const meshes = createMeshes('cards', {
        ...descriptor,
        meshes: [...ids.map(id => ({ id })), descriptor.meshes[0]],
        slots
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
      meshes: ids.map(id => ({ id })),
      bags: new Map([['cards', ids]]),
      slots: [
        { bagId: 'cards', x: 10, count: 2 },
        { bagId: 'cards', x: 5, count: 1 },
        { bagId: 'cards', x: 1 }
      ]
    }

    it('draws meshes to fill slots', () => {
      const meshes = createMeshes('cards', descriptor)
      expect(meshes).toEqual(
        expect.arrayContaining(descriptor.meshes.map(expect.objectContaining))
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

function expectSnappedByName(meshes, name, anchor) {
  const candidates = meshes.filter(mesh => name === mesh.name)
  expect(candidates).toHaveLength(1)
  expect(anchor.snappedId).toEqual(candidates[0].id)
}
