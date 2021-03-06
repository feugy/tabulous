import { faker } from '@faker-js/faker'
import { get } from 'svelte/store'
import {
  configures3dTestEngine,
  expectScreenPosition,
  sleep,
  waitNextRender
} from '../test-utils'
import { createCard } from '../../src/3d/meshes'
import { actionMenuProps } from '../../src/stores/game-engine'
import { gamePlayerById } from '../../src/stores/game-manager'
import {
  areIndicatorsVisible as areIndicatorsVisible$,
  initIndicators,
  toggleIndicators,
  visibleIndicators as visibleIndicators$
} from '../../src/stores/indicators'
import { AnchorBehaviorName, StackBehaviorName } from '../../src/3d/behaviors'
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

jest.mock('../../src/stores/game-manager', () => {
  const { BehaviorSubject } = require('rxjs')
  return { gamePlayerById: new BehaviorSubject(new Map()) }
})

describe('Indicators store', () => {
  let engine
  let scene
  let cards
  let players
  const renderWidth = 2048
  const renderHeight = 1024
  const canvas = document.createElement('div')
  const hand = document.createElement('div')

  configures3dTestEngine(
    created => {
      scene = created.scene
      engine = created.engine
    },
    { renderWidth, renderHeight }
  )

  beforeAll(() => {
    indicatorManager.init({ scene })
    players = [
      {
        id: faker.datatype.uuid(),
        username: faker.name.findName()
      },
      {
        id: faker.datatype.uuid(),
        username: faker.name.findName()
      },
      {
        id: faker.datatype.uuid(),
        username: faker.name.findName()
      }
    ]
  })

  beforeEach(async () => {
    initIndicators({ engine, canvas, hand })
    cards = [
      { id: 'card1' },
      { id: 'card2', x: 1 },
      { id: 'card3', x: -1 },
      { id: 'card4', x: 5 },
      { id: 'card5', x: -5 },
      { id: 'card6', z: 5 }
    ].map(params => createCard({ ...params, stackable: {}, anchorable: {} }))
    actionMenuProps.next(null)
    selectionManager.clear()
  })

  it('shows indicators by default', async () => {
    expect(get(areIndicatorsVisible$)).toBe(true)
  })

  describe('given no hand', () => {
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
      expectIndicators([
        {
          id: `${card4.id}.stack-size`,
          size: 3,
          screenPosition: { x: 1024, y: 511.8 }
        },
        {
          id: `${card5.id}.stack-size`,
          size: 2,
          screenPosition: { x: 999.78, y: 511.9 }
        }
      ])
    })

    it('has feedback', async () => {
      const indicator = { position: [1, 0, -1], isFeedback: true }
      indicatorManager.registerFeedback(indicator)
      await waitNextRender(scene)
      expectIndicators([indicator])
    })
  })

  describe('given hand container', () => {
    beforeEach(() => notifyHandResize(10))

    describe('given hidden indicators', () => {
      beforeEach(() => {
        if (get(areIndicatorsVisible$)) {
          toggleIndicators()
        }
      })

      it('has feedback', async () => {
        const indicator = { position: [1, 0, -1], isFeedback: true }
        indicatorManager.registerFeedback(indicator)
        await waitNextRender(scene)
        expectIndicators([indicator])
      })

      it('retains feedback for 3 seconds', async () => {
        const indicator = { position: [1, 0, -1], isFeedback: true }
        indicatorManager.registerFeedback(indicator)
        await waitNextRender(scene)
        expectIndicators([indicator])
        indicatorManager.onChangeObservable.notifyObservers([])
        await sleep(1100)
        await waitNextRender(scene)
        expectIndicators([indicator])
        await sleep(1100)
        await waitNextRender(scene)
        expectIndicators([indicator])
        await sleep(1100)
        await waitNextRender(scene)
        expectIndicators()
      })

      it('has indicators for each selected mesh', () => {
        const [card1, , card3, , card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['card2', 'card4'] })
        card3
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['card5'] })
        expectIndicators()
        selectionManager.select(card5, card3)
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 902.9, y: 512 }
          }
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
        expectIndicators()
        actionMenuProps.next({ interactedMesh: card5 })
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 902.9, y: 512 }
          }
        ])
      })

      it('has no indicator for un-stacked menu mesh', () => {
        const [card1, , card3] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['card2', 'card4'] })
        expectIndicators()
        actionMenuProps.next({ interactedMesh: card3 })
        expectIndicators()
      })

      it('has indicator for selected menu mesh', () => {
        const [card1, card2, card3, card4, card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['card2', 'card4'] })
        card3
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['card5'] })
        expectIndicators()
        selectionManager.select(card5, card3, card2, card1, card4)
        expectIndicators([
          {
            id: `${card4.id}.stack-size`,
            size: 3,
            screenPosition: { x: 1145.099, y: 512 }
          },
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 902.9, y: 512 }
          }
        ])
        actionMenuProps.next({ interactedMesh: card4 })
        expectIndicators([
          {
            id: `${card4.id}.stack-size`,
            size: 3,
            screenPosition: { x: 1145.099, y: 512 }
          },
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 902.9, y: 512 }
          }
        ])
      })

      it('has indicators when toggling visibility', () => {
        const [card1, , , , card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['card4', 'card5'] })
        expectIndicators()
        toggleIndicators()
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 3,
            screenPosition: { x: 902.9, y: 512 }
          }
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
        expectIndicators([
          {
            id: `${card4.id}.stack-size`,
            size: 3,
            screenPosition: { x: 1024, y: 511.796 }
          },
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 999.78, y: 511.898 }
          }
        ])
      })

      it('has no indicator for empty stacks', () => {
        const [card1, , card3, , card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['card4', 'card5'] })
        card3.getBehaviorByName(StackBehaviorName).fromState({})
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 3,
            screenPosition: { x: 902.9, y: 512 }
          }
        ])
      })

      it('has no indicator when toggling visibility', () => {
        const [card1, , , , card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['card4', 'card5'] })
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 3,
            screenPosition: { x: 902.9, y: 512 }
          }
        ])
        toggleIndicators()
        expectIndicators()
      })

      it('updates indicators on action', async () => {
        const [card1, , , , card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['card4', 'card5'] })
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 3,
            screenPosition: { x: 902.9, y: 512 }
          }
        ])
        await card1.metadata.flipAll()
        expectIndicators([
          {
            id: `${card1.id}.stack-size`,
            size: 3,
            screenPosition: { x: 1024, y: 512 }
          }
        ])
      })

      it('has no player data on drop zones', async () => {
        const [card] = cards
        card
          .getBehaviorByName(AnchorBehaviorName)
          .fromState({ anchors: [{ playerId: players[0].id }] })
        expectIndicators([
          {
            id: `${players[0].id}.drop-zone.anchor-0`,
            screenPosition: { x: 1024, y: 512 }
          }
        ])
      })

      it('updates indicators on hand resize', async () => {
        const [card1, , , card4, card5, card6] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['card2', 'card4'] })
        card6
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['card5'] })

        const indicators = [
          {
            id: `${card4.id}.stack-size`,
            size: 3,
            screenPosition: { x: 1024, y: 511.796 }
          },
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 1024, y: 404.123 }
          }
        ]

        await waitNextRender(scene)
        expectIndicators(indicators)

        await notifyHandResize(renderHeight * 0.51)
        expectIndicators(indicators.slice(1))
      })
    })

    describe('given current game', () => {
      beforeAll(() => {
        gamePlayerById.next(new Map(players.map(player => [player.id, player])))
        if (!get(areIndicatorsVisible$)) {
          toggleIndicators()
        }
      })

      it('has player indicators for drop zones', async () => {
        const [card1, card2] = cards
        card1
          .getBehaviorByName(AnchorBehaviorName)
          .fromState({ anchors: [{ playerId: players[0].id }] })
        card2
          .getBehaviorByName(AnchorBehaviorName)
          .fromState({ anchors: [{ playerId: players[1].id }] })
        expectIndicators([
          {
            id: `${players[0].id}.drop-zone.anchor-0`,
            player: players[0],
            screenPosition: { x: 1024, y: 512 }
          },
          {
            id: `${players[1].id}.drop-zone.anchor-0`,
            player: players[1],
            screenPosition: { x: 1048.22, y: 512 }
          }
        ])
      })
    })
  })

  function expectIndicators(expected = []) {
    const visibleIndicators = get(visibleIndicators$)
    expect(visibleIndicators).toHaveLength(expected.length)
    for (const [
      rank,
      { screenPosition, id, ...otherProps }
    ] of expected.entries()) {
      const actual = visibleIndicators[rank]
      expect(actual).toHaveProperty('id', id)
      expect(actual).toEqual(expect.objectContaining(otherProps))
      expectScreenPosition(actual.screenPosition, screenPosition)
    }
  }

  async function notifyHandResize(height) {
    jest.spyOn(window, 'getComputedStyle').mockImplementation(node => ({
      height: `${node === canvas ? renderHeight : height}px`
    }))
    window.resizeObservers[0].notify()
    await sleep(20)
  }
})
