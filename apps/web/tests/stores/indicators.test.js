import { get } from 'svelte/store'
import {
  configures3dTestEngine,
  expectScreenPosition,
  waitNextRender
} from '../test-utils'
import { createCard } from '../../src/3d/meshes'
import { actionMenuProps } from '../../src/stores/game-engine'
import {
  areIndicatorsVisible as areIndicatorsVisible$,
  stackSizes as stackSizes$,
  toggleIndicators
} from '../../src/stores/indicators'
import { StackBehaviorName } from '../../src/3d/behaviors'
import { indicatorManager, selectionManager } from '../../src/3d/managers'

jest.mock('../../src/stores/game-engine', () => {
  const { BehaviorSubject } = require('rxjs')
  const {
    indicatorManager,
    selectionManager
  } = require('../../src/3d/managers')
  const indicators = new BehaviorSubject([])
  const selectedMeshes = new BehaviorSubject(new Set())
  indicatorManager.onChangeObservable.add(indicators.next.bind(indicators))
  selectionManager.onSelectionObservable.add(
    selectedMeshes.next.bind(selectedMeshes)
  )
  return {
    indicators,
    selectedMeshes,
    actionMenuProps: new BehaviorSubject()
  }
})

describe('Indicators store', () => {
  let scene
  let cards

  configures3dTestEngine(created => {
    scene = created.scene
  })

  beforeAll(() => indicatorManager.init({ scene }))

  beforeEach(() => {
    cards = [
      { id: 'card1' },
      { id: 'card2', x: 1 },
      { id: 'card3', x: -1 },
      { id: 'card4', x: 5 },
      { id: 'card5', x: -5 },
      { id: 'card6', z: 5 }
    ].map(params => createCard({ ...params, stackable: {} }))
    actionMenuProps.next(null)
    selectionManager.clear()
  })

  it('shows indicators by default', async () => {
    expect(get(areIndicatorsVisible$)).toBe(true)
  })

  describe('given hidden indicators', () => {
    beforeEach(() => {
      if (get(areIndicatorsVisible$)) {
        toggleIndicators()
      }
    })

    it('has indicators for each selected mesh', () => {
      const [card1, , card3, , card5] = cards
      card1
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card2', 'card4'] })
      card3
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card5'] })
      expectStackSizes([])
      selectionManager.select(card5, card3)
      expectStackSizes([
        { id: card5.id, size: 2, screenPosition: { x: 902.9, y: 512 } }
      ])
    })

    it('has indicators for menu mesh', () => {
      const [card1, , card3, , card5] = cards
      card1
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card2', 'card4'] })
      card3
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card5'] })
      expectStackSizes([])
      actionMenuProps.next({ interactedMesh: card5 })
      expectStackSizes([
        { id: card5.id, size: 2, screenPosition: { x: 902.9, y: 512 } }
      ])
    })

    it('has no indicator for un-stacked menu mesh', () => {
      const [card1, , card3] = cards
      card1
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card2', 'card4'] })
      expectStackSizes([])
      actionMenuProps.next({ interactedMesh: card3 })
      expectStackSizes([])
    })

    it('has indicator for selected menu mesh', () => {
      const [card1, card2, card3, card4, card5] = cards
      card1
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card2', 'card4'] })
      card3
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card5'] })
      expectStackSizes([])
      selectionManager.select(card5, card3, card2, card1, card4)
      expectStackSizes([
        { id: card4.id, size: 3, screenPosition: { x: 1145.099, y: 512 } },
        { id: card5.id, size: 2, screenPosition: { x: 902.9, y: 512 } }
      ])
      actionMenuProps.next({ interactedMesh: card4 })
      expectStackSizes([
        { id: card4.id, size: 3, screenPosition: { x: 1145.099, y: 512 } },
        { id: card5.id, size: 2, screenPosition: { x: 902.9, y: 512 } }
      ])
    })

    it('has indicators when toggling visibility', () => {
      const [card1, , , , card5] = cards
      card1
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card4', 'card5'] })
      expectStackSizes([])
      toggleIndicators()
      expectStackSizes([
        { id: card5.id, size: 3, screenPosition: { x: 902.9, y: 512 } }
      ])
    })
  })

  describe('given visible indicators', () => {
    beforeEach(() => {
      if (!get(areIndicatorsVisible$)) {
        toggleIndicators()
      }
    })

    it('has indicators for each stackable mesh', async () => {
      const [card1, , card3, card4, card5] = cards
      card1
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card2', 'card4'] })
      card3
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card5'] })

      await waitNextRender(scene)
      expectStackSizes([
        { id: card4.id, size: 3, screenPosition: { x: 1024, y: 511.796 } },
        { id: card5.id, size: 2, screenPosition: { x: 999.78, y: 511.898 } }
      ])
    })

    it('has no indicator for empty stacks', () => {
      const [card1, , card3, , card5] = cards
      card1
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card4', 'card5'] })
      card3.getBehaviorByName(StackBehaviorName).fromState({})
      expectStackSizes([
        { id: card5.id, size: 3, screenPosition: { x: 902.9, y: 512 } }
      ])
    })

    it('has no indicator when toggling visibility', () => {
      const [card1, , , , card5] = cards
      card1
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card4', 'card5'] })
      expectStackSizes([
        { id: card5.id, size: 3, screenPosition: { x: 902.9, y: 512 } }
      ])
      toggleIndicators()
      expectStackSizes([])
    })

    it('updates indicators on action', async () => {
      const [card1, , , , card5] = cards
      card1
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['card4', 'card5'] })
      expectStackSizes([
        { id: card5.id, size: 3, screenPosition: { x: 902.9, y: 512 } }
      ])
      await card1.metadata.flipAll()
      expectStackSizes([
        { id: card1.id, size: 3, screenPosition: { x: 1024, y: 512 } }
      ])
    })
  })

  function expectStackSizes(expected) {
    const stackSizes = get(stackSizes$)
    expect(stackSizes).toHaveLength(expected.length)
    for (const [rank, { screenPosition, size, id }] of expected.entries()) {
      const actual = stackSizes[rank]
      expect(actual).toHaveProperty('id', `${id}.stack-size`)
      expect(actual).toHaveProperty('size', size)
      expectScreenPosition(actual.screenPosition, screenPosition)
    }
  }
})
