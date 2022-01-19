import { createMeshes } from '../../src/services/utils.js'

describe('createMeshes()', () => {
  it('ignores missing mesh', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      meshes: ids.map(id => ({ id })),
      bags: new Map([['cards', ['card-null', 'card-1', 'card', 'card-2']]]),
      slots: [{ bagId: 'cards', x: 1, y: 2, z: 3 }]
    }
    expect(createMeshes(descriptor)).toEqual(
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
    expect(createMeshes(descriptor)).toEqual(descriptor.meshes)
  })

  it('ignores missing slots', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      meshes: ids.map(id => ({ id })),
      bags: new Map([['cards', ids]])
    }
    expect(createMeshes(descriptor)).toEqual(descriptor.meshes)
  })

  it('ignores no bags', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      meshes: ids.map(id => ({ id })),
      slots: [{ bagId: 'unknown', x: 1, y: 2, z: 3 }]
    }
    expect(createMeshes(descriptor)).toEqual(descriptor.meshes)
  })

  describe('given a descriptor with single bag and slot', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      meshes: ids.map(id => ({ id })),
      bags: new Map([['cards', ids]]),
      slots: [{ bagId: 'cards', x: 1, y: 2, z: 3 }]
    }

    it('stacks meshes on slots with random order', () => {
      const meshes = createMeshes(descriptor)
      expect(meshes).toEqual(
        expect.arrayContaining(descriptor.meshes.map(expect.objectContaining))
      )
      expect(meshes).not.toEqual(descriptor.cards)
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
      const meshes1 = createMeshes(descriptor)
      const meshes2 = createMeshes(descriptor)
      expect(meshes1).not.toEqual(descriptor.meshes)
      expect(meshes2).not.toEqual(descriptor.meshes)
      expect(meshes1).not.toEqual(meshes2)
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
      const meshes = createMeshes(descriptor)
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
