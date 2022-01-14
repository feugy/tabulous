import { instanciateGame } from '../../src/services/utils.js'

describe('instanciateGame()', () => {
  it('ignores missing mesh', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      cards: ids.map(id => ({ id })),
      bags: new Map([['cards', ['card-null', 'card-1', 'card', 'card-2']]]),
      slots: [{ bagId: 'cards', x: 1, y: 2, z: 3 }]
    }
    const scene = instanciateGame(descriptor)
    expect(scene).toEqual({
      cards: expect.arrayContaining(
        descriptor.cards.map(expect.objectContaining)
      ),
      roundTokens: [],
      roundedTiles: [],
      boards: []
    })
  })

  it('ignores missing bags', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      cards: ids.map(id => ({ id })),
      bags: new Map([['cards', ids]]),
      slots: [{ bagId: 'unknown', x: 1, y: 2, z: 3 }]
    }
    const scene = instanciateGame(descriptor)
    expect(scene).toEqual({
      cards: descriptor.cards,
      roundTokens: [],
      roundedTiles: [],
      boards: []
    })
  })

  it('ignores missing slots', () => {
    const ids = Array.from({ length: 3 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      cards: ids.map(id => ({ id })),
      bags: new Map([['cards', ids]])
    }
    const scene = instanciateGame(descriptor)
    expect(scene).toEqual({
      cards: descriptor.cards,
      roundTokens: [],
      roundedTiles: [],
      boards: []
    })
  })

  describe('given a descriptor with single bag and slot', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      cards: ids.map(id => ({ id })),
      bags: new Map([['cards', ids]]),
      slots: [{ bagId: 'cards', x: 1, y: 2, z: 3 }]
    }

    it('stacks meshes on slots with random order', () => {
      const scene = instanciateGame(descriptor)
      expect(scene).toEqual({
        cards: expect.arrayContaining(
          descriptor.cards.map(expect.objectContaining)
        ),
        roundTokens: [],
        roundedTiles: [],
        boards: []
      })
      expect(scene.cards).not.toEqual(descriptor.cards)
      expect(
        scene.cards.filter(({ stackable }) => stackable?.stack.length === 9)
      ).toHaveLength(1)
      const slot = descriptor.slots[0]
      expect(
        scene.cards.every(
          ({ x, y, z }) => x === slot.x && y === slot.y && z === slot.z
        )
      ).toBe(true)
    })

    it('applies different slot order on different games', () => {
      const scene1 = instanciateGame(descriptor)
      const scene2 = instanciateGame(descriptor)
      expect(scene1.cards).not.toEqual(descriptor.cards)
      expect(scene2.cards).not.toEqual(descriptor.cards)
      expect(scene1.cards).not.toEqual(scene2.cards)
    })
  })

  describe('given a descriptor with multiple slots on the same bag', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `card-${i + 1}`)
    const descriptor = {
      cards: ids.map(id => ({ id })),
      bags: new Map([['cards', ids]]),
      slots: [
        { bagId: 'cards', x: 10, count: 2 },
        { bagId: 'cards', x: 5, count: 1 },
        { bagId: 'cards', x: 1 }
      ]
    }

    it('draws meshes to fill slots', () => {
      const scene = instanciateGame(descriptor)
      expect(scene).toEqual({
        cards: expect.arrayContaining(
          descriptor.cards.map(expect.objectContaining)
        ),
        roundTokens: [],
        roundedTiles: [],
        boards: []
      })
      expect(
        scene.cards.filter(({ stackable }) => stackable?.stack.length === 1)
      ).toHaveLength(1)
      expect(scene.cards.filter(({ x }) => x === 10)).toHaveLength(2)
      expect(scene.cards.filter(({ x }) => x === 5)).toHaveLength(1)
      expect(
        scene.cards.filter(({ stackable }) => stackable?.stack.length === 6)
      ).toHaveLength(1)
      expect(scene.cards.filter(({ x }) => x === 1)).toHaveLength(7)
    })
  })
})
