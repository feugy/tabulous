import { get } from 'svelte/store'
import { configures3dTestEngine, expectScreenPosition } from '../test-utils'
import { createCard } from '../../src/3d/meshes'
import {
  areIndicatorsVisible as areIndicatorsVisible$,
  indicators as indicators$,
  toggleIndicators
} from '../../src/stores/indicators'
import {
  controlledMeshes as controlledMeshes$,
  meshForMenu as meshForMenu$,
  selectedMeshes as selectedMeshes$
} from '../../src/stores/game-engine'
import { StackBehavior } from '../../src/3d/behaviors'

jest.mock('../../src/stores/game-engine', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    currentCamera: new BehaviorSubject({}),
    controlledMeshes: new BehaviorSubject(new Map()),
    selectedMeshes: new BehaviorSubject(new Set()),
    meshForMenu: new BehaviorSubject()
  }
})

describe('Indicators store', () => {
  configures3dTestEngine()

  let cards

  beforeEach(() => {
    cards = [
      { id: 'card1' },
      { id: 'card2', x: 1 },
      { id: 'card3', x: -1 },
      { id: 'card4', x: 5 },
      { id: 'card5', x: -5 },
      { id: 'card6', z: 5 }
    ].map(params => createCard(params))
  })

  afterEach(() => {
    controlledMeshes$.next(new Map())
    selectedMeshes$.next(new Set())
    meshForMenu$.next()
  })

  it('hides indicators by default', async () => {
    expect(get(areIndicatorsVisible$)).toBe(false)
  })

  describe('given hiden indicators', () => {
    beforeEach(() => {
      if (get(areIndicatorsVisible$)) {
        toggleIndicators()
      }
    })

    it('has indicators for each selected mesh', () => {
      const [card1, , card3, , card5] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card2', 'card4'] }),
        true
      )
      card3.addBehavior(new StackBehavior({ stackIds: ['card5'] }), true)
      updateControlled()
      expectIndicators([])
      selectedMeshes$.next(new Set([card5, card3]))
      expectIndicators([{ id: card3.id, size: 2, x: 999.78, y: 511.954 }])
    })

    it('has indicators for menu mesh', () => {
      const [card1, , card3, , card5] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card2', 'card4'] }),
        true
      )
      card3.addBehavior(new StackBehavior({ stackIds: ['card5'] }), true)
      updateControlled()
      expectIndicators([])
      meshForMenu$.next(card5)
      expectIndicators([{ id: card3.id, size: 2, x: 999.78, y: 511.954 }])
    })

    it('has no indicator for un-stacked menu mesh', () => {
      const [card1, , card3] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card2', 'card4'] }),
        true
      )
      updateControlled()
      expectIndicators([])
      meshForMenu$.next(card3)
      expectIndicators([])
    })

    it('has indicator for selected menu mesh', () => {
      const [card1, card2, card3, card4, card5] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card2', 'card4'] }),
        true
      )
      card3.addBehavior(new StackBehavior({ stackIds: ['card5'] }), true)
      updateControlled()
      expectIndicators([])
      selectedMeshes$.next(new Set([card5, card3, card2, card1, card4]))
      expectIndicators([
        { id: card1.id, size: 3, x: 1024, y: 511.954 },
        { id: card3.id, size: 2, x: 999.78, y: 511.954 }
      ])
      meshForMenu$.next(card4)
      expectIndicators([
        { id: card1.id, size: 3, x: 1024, y: 511.954 },
        { id: card3.id, size: 2, x: 999.78, y: 511.954 }
      ])
    })

    it('has indicators when toggling visibility', () => {
      const [card1] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card4', 'card5'] }),
        true
      )
      updateControlled()
      expectIndicators([])
      toggleIndicators()
      expectIndicators([{ id: card1.id, size: 3, x: 1024, y: 511.954 }])
    })
  })

  describe('given visible indicators', () => {
    beforeEach(() => {
      if (!get(areIndicatorsVisible$)) {
        toggleIndicators()
      }
    })

    it('has indicators for each stackable mesh', () => {
      const [card1, , card3] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card2', 'card4'] }),
        true
      )
      card3.addBehavior(new StackBehavior({ stackIds: ['card5'] }), true)
      updateControlled()
      expectIndicators([
        { id: card1.id, size: 3, x: 1024, y: 511.954 },
        { id: card3.id, size: 2, x: 999.78, y: 511.954 }
      ])
    })

    it('has no indicator for empty stacks', () => {
      const [card1, card2, card3] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card4', 'card5'] }),
        true
      )
      card2.addBehavior(new StackBehavior(), true)
      card3.addBehavior(new StackBehavior({ stackIds: ['card6'] }), true)
      updateControlled()
      expectIndicators([
        { id: card1.id, size: 3, x: 1024, y: 511.954 },
        { id: card3.id, size: 2, x: 999.78, y: 511.954 }
      ])
    })

    it('has no indicator when toggling visibility', () => {
      const [card1] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card4', 'card5'] }),
        true
      )
      updateControlled()
      expectIndicators([{ id: card1.id, size: 3, x: 1024, y: 511.954 }])
      toggleIndicators()
      expectIndicators([])
    })
  })

  function updateControlled() {
    controlledMeshes$.next(new Map(cards.map(card => [card.id, card])))
  }

  function expectIndicators(expected) {
    const indicators = get(indicators$)
    expect(indicators).toHaveLength(expected.length)
    for (const [rank, { x, y, size, id }] of expected.entries()) {
      const actual = indicators[rank]
      expect(actual).toHaveProperty('id', id)
      expect(actual).toHaveProperty('size', size)
      expectScreenPosition(actual, { x, y })
    }
  }
})
