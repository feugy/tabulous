import { get } from 'svelte/store'
import { configures3dTestEngine } from '../test-utils'
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

  function updateControlled() {
    controlledMeshes$.next(new Map(cards.map(card => [card.id, card])))
  }

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
      expect(get(indicators$)).toEqual([])
      selectedMeshes$.next(new Set([card5, card3]))
      expect(get(indicators$)).toEqual([
        { id: card3.id, size: 2, x: 999.7801220703125, y: 512 }
      ])
    })

    it('has indicators for menu mesh', () => {
      const [card1, , card3, , card5] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card2', 'card4'] }),
        true
      )
      card3.addBehavior(new StackBehavior({ stackIds: ['card5'] }), true)
      updateControlled()
      expect(get(indicators$)).toEqual([])
      meshForMenu$.next(card5)
      expect(get(indicators$)).toEqual([
        { id: card3.id, size: 2, x: 999.7801220703125, y: 512 }
      ])
    })

    it('has no indicator for un-stacked menu mesh', () => {
      const [card1, , card3] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card2', 'card4'] }),
        true
      )
      updateControlled()
      expect(get(indicators$)).toEqual([])
      meshForMenu$.next(card3)
      expect(get(indicators$)).toEqual([])
    })

    it('has indicator for selected menu mesh', () => {
      const [card1, card2, card3, card4, card5] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card2', 'card4'] }),
        true
      )
      card3.addBehavior(new StackBehavior({ stackIds: ['card5'] }), true)
      updateControlled()
      expect(get(indicators$)).toEqual([])
      selectedMeshes$.next(new Set([card5, card3, card2, card1, card4]))
      expect(get(indicators$)).toEqual([
        { id: card1.id, size: 3, x: 1024, y: 512 },
        { id: card3.id, size: 2, x: 999.7801220703125, y: 512 }
      ])
      meshForMenu$.next(card4)
      expect(get(indicators$)).toEqual([
        { id: card1.id, size: 3, x: 1024, y: 512 },
        { id: card3.id, size: 2, x: 999.7801220703125, y: 512 }
      ])
    })

    it('has indicators when toggling visibility', () => {
      const [card1] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card4', 'card5'] }),
        true
      )
      updateControlled()
      expect(get(indicators$)).toEqual([])
      toggleIndicators()
      expect(get(indicators$)).toEqual([
        { id: card1.id, size: 3, x: 1024, y: 512 }
      ])
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
      expect(get(indicators$)).toEqual([
        { id: card1.id, size: 3, x: 1024, y: 512 },
        { id: card3.id, size: 2, x: 999.7801220703125, y: 512 }
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
      expect(get(indicators$)).toEqual([
        { id: card1.id, size: 3, x: 1024, y: 512 },
        { id: card3.id, size: 2, x: 999.7801220703125, y: 512 }
      ])
    })

    it('has no indicator when toggling visibility', () => {
      const [card1] = cards
      card1.addBehavior(
        new StackBehavior({ stackIds: ['card4', 'card5'] }),
        true
      )
      updateControlled()
      expect(get(indicators$)).toEqual([
        { id: card1.id, size: 3, x: 1024, y: 512 }
      ])
      toggleIndicators()
      expect(get(indicators$)).toEqual([])
    })
  })
})
