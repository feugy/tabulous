// @ts-check
import { faker } from '@faker-js/faker'
import {
  AnchorBehaviorName,
  QuantityBehaviorName,
  StackBehaviorName
} from '@src/3d/behaviors'
import { createCard } from '@src/3d/meshes'
import {
  actionMenuProps as actualActionMenuProps,
  indicators,
  selectedMeshes
} from '@src/stores/game-engine'
import { gamePlayerById as actualGamePlayerById } from '@src/stores/game-manager'
import {
  areIndicatorsVisible as areIndicatorsVisible$,
  initIndicators,
  toggleIndicators,
  visibleFeedbacks as visibleFeedbacks$,
  visibleIndicators as visibleIndicators$
} from '@src/stores/indicators'
import {
  configures3dTestEngine,
  expectScreenPosition,
  sleep,
  waitNextRender
} from '@tests/test-utils'
import { get } from 'svelte/store'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/game-engine', async () => {
  const { BehaviorSubject } = await import('rxjs')
  const indicators = new BehaviorSubject(
    /** @type {import('@src/3d/managers').Indicator[]} */ ([])
  )
  const selectedMeshes = new BehaviorSubject(new Set())
  return {
    indicators,
    selectedMeshes,
    actionMenuProps: new BehaviorSubject(null)
  }
})

vi.mock('@src/stores/game-manager', async () => {
  const { BehaviorSubject } = await import('rxjs')
  return { gamePlayerById: new BehaviorSubject(new Map()) }
})

describe('Indicators store', () => {
  /** @type {import('@babylonjs/core').Engine} */
  let engine
  /** @type {import('@babylonjs/core').Scene} */
  let scene
  /** @type {import('@babylonjs/core').Mesh[]} */
  let cards
  /** @type {import('@src/stores').PlayerWithPref[]} */
  let players
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  /** @type {import('vitest').Mock<[HTMLElement], CSSStyleDeclaration>} */
  let getComputedStyle
  const renderWidth = 2048
  const renderHeight = 1024
  const canvas = document.createElement('canvas')
  const hand = document.createElement('div')
  const actionMenuProps =
    /** @type {import('rxjs').BehaviorSubject<?import('@src/utils/game-interaction').ActionMenuProps>} */ (
      actualActionMenuProps
    )
  const gamePlayerById =
    /** @type {import('rxjs').BehaviorSubject<Map<string, import('@src/stores').PlayerWithPref>>} */ (
      actualGamePlayerById
    )

  configures3dTestEngine(
    created => {
      ;({ engine, scene, managers, getComputedStyle } = created)
      engine.managers = managers
      players = [
        {
          id: faker.string.uuid(),
          username: faker.person.fullName(),
          isGuest: false,
          isOwner: false,
          isHost: false,
          playing: false,
          currentGameId: null
        },
        {
          id: faker.string.uuid(),
          username: faker.person.fullName(),
          isGuest: true,
          isOwner: false,
          isHost: false,
          playing: false,
          currentGameId: null
        },
        {
          id: faker.string.uuid(),
          username: faker.person.fullName(),
          isGuest: false,
          isOwner: true,
          isHost: false,
          playing: false,
          currentGameId: null
        }
      ]

      managers.indicator.onChangeObservable.add(
        /** @type {import('rxjs').BehaviorSubject<import('@src/3d/managers').Indicator[]>} */ (
          indicators
        ).next.bind(indicators)
      )
      managers.selection.onSelectionObservable.add(
        /** @type {import('rxjs').BehaviorSubject<Set<import('@babylonjs/core').Mesh>>} */ (
          selectedMeshes
        ).next.bind(selectedMeshes)
      )
    },
    { renderWidth, renderHeight }
  )

  beforeEach(async () => {
    initIndicators({ engine, canvas, hand })
    cards = [
      { id: 'card1' },
      { id: 'card2', x: 1 },
      { id: 'card3', x: -1 },
      { id: 'card4', x: 5 },
      { id: 'card5', x: -5 },
      { id: 'card6', z: 5 }
    ].map(params =>
      createCard(
        {
          ...params,
          texture: '',
          stackable: {},
          anchorable: {},
          quantifiable: {}
        },
        managers,
        scene
      )
    )
    actionMenuProps.next(null)
    managers.selection.clear()
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
      const [card1, card2, card3, , card5] = cards
      card1
        .getBehaviorByName(StackBehaviorName)
        ?.fromState({ stackIds: ['card4', 'card5'] })
      card2.getBehaviorByName(QuantityBehaviorName)?.fromState({ quantity: 5 })
      card3.getBehaviorByName(QuantityBehaviorName)?.fromState({ quantity: 1 })

      await waitNextRender(scene)
      expectIndicators([
        {
          id: `${card5.id}.stack-size`,
          size: 3,
          screenPosition: { x: 1024, y: 464.81 },
          onClick: expect.any(Function)
        },
        {
          id: `${card2.id}.quantity`,
          size: 5,
          screenPosition: { x: 1047.83, y: 465.21 },
          onClick: expect.any(Function)
        }
      ])
    })

    it('has indicators for quantifiable meshes with quantity higher than 1', async () => {
      const [card1, , card3, card4, card5] = cards
      card1
        .getBehaviorByName(StackBehaviorName)
        ?.fromState({ stackIds: ['card2', 'card4'] })
      card3
        .getBehaviorByName(StackBehaviorName)
        ?.fromState({ stackIds: ['card5'] })

      await waitNextRender(scene)
      expectIndicators([
        {
          id: `${card4.id}.stack-size`,
          size: 3,
          screenPosition: { x: 1024, y: 464.81 },
          onClick: expect.any(Function)
        },
        {
          id: `${card5.id}.stack-size`,
          size: 2,
          screenPosition: { x: 1000.16, y: 465 },
          onClick: expect.any(Function)
        }
      ])
    })

    it('selects and unselects stacked meshes when with their indicators', async () => {
      cards[0]
        .getBehaviorByName(StackBehaviorName)
        ?.fromState({ stackIds: ['card2', 'card4'] })
      await waitNextRender(scene)

      get(visibleIndicators$)[0].onClick?.()
      expect(managers.selection.meshes.has(cards[0])).toBe(true)
      expect(managers.selection.meshes.has(cards[1])).toBe(true)
      expect(managers.selection.meshes.has(cards[2])).toBe(false)
      expect(managers.selection.meshes.has(cards[3])).toBe(true)
      expect(managers.selection.meshes.has(cards[4])).toBe(false)

      get(visibleIndicators$)[0].onClick?.()
      expect(managers.selection.meshes.size).toBe(0)
    })

    it('selects and unselects quantifiable meshes when with their indicators', async () => {
      cards[0]
        .getBehaviorByName(QuantityBehaviorName)
        ?.fromState({ quantity: 4 })
      await waitNextRender(scene)

      get(visibleIndicators$)[0].onClick?.()
      expect(managers.selection.meshes.has(cards[0])).toBe(true)

      get(visibleIndicators$)[0].onClick?.()
      expect(managers.selection.meshes.size).toBe(0)
    })

    it('has feedback', async () => {
      /** @type {import('@src/3d/managers').FeedbackIndicator} */
      const indicator = { position: [1, 0, -1], action: 'flip' }
      managers.indicator.registerFeedback(indicator)
      await waitNextRender(scene)
      expectFeedbacks([indicator])
    })

    it('hovers indicators when hovering their mesh', async () => {
      const [, , , card4] = cards
      cards[0]
        .getBehaviorByName(StackBehaviorName)
        ?.fromState({ stackIds: ['card2', 'card4'] })
      await waitNextRender(scene)
      expectIndicators([
        { id: `${card4.id}.stack-size`, size: 3, hovered: false }
      ])

      managers.input.onHoverObservable.notifyObservers({
        type: 'hoverStart',
        mesh: card4,
        event: /** @type {PointerEvent} */ (new MouseEvent('mousemove')),
        timestamp: Date.now()
      })
      await waitNextRender(scene)
      expectIndicators([
        { id: `${card4.id}.stack-size`, size: 3, hovered: true }
      ])

      managers.input.onHoverObservable.notifyObservers({
        type: 'hoverStop',
        mesh: card4,
        event: /** @type {PointerEvent} */ (new MouseEvent('mousemove')),
        timestamp: Date.now()
      })
      await waitNextRender(scene)
      expectIndicators([
        { id: `${card4.id}.stack-size`, size: 3, hovered: false }
      ])
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

      it('has no feedback', async () => {
        /** @type {import('@src/3d/managers').FeedbackIndicator} */
        const indicator = { position: [1, 0, -1], action: 'pop' }
        managers.indicator.registerFeedback(indicator)
        await waitNextRender(scene)
        expectFeedbacks([])
      })

      it('has indicators for each selected mesh', () => {
        const [card1, , card3, , card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card2', 'card4'] })
        card3
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card5'] })
        expectIndicators()
        managers.selection.select([card5, card3])
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 904.84, y: 465.21 }
          }
        ])
      })

      it('has indicators for menu mesh', () => {
        const [card1, , card3, , card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card2', 'card4'] })
        card3
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card5'] })
        expectIndicators()
        actionMenuProps.next(
          /** @type {import('@src/utils/game-interaction').ActionMenuProps} */ ({
            interactedMesh: card5
          })
        )
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 904.84, y: 465.21 }
          }
        ])
      })

      it('has no indicator for un-stacked menu mesh', () => {
        const [card1, , card3] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card2', 'card4'] })
        expectIndicators()
        actionMenuProps.next(
          /** @type {import('@src/utils/game-interaction').ActionMenuProps} */ ({
            interactedMesh: card3
          })
        )
        expectIndicators()
      })

      it('has indicator for selected menu mesh', () => {
        const [card1, card2, card3, card4, card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card2', 'card4'] })
        card3
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card5'] })
        expectIndicators()
        managers.selection.select([card5, card3, card2, card1, card4])
        expectIndicators([
          {
            id: `${card4.id}.stack-size`,
            size: 3,
            screenPosition: { x: 1143.16, y: 465.21 }
          },
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 904.84, y: 465.21 }
          }
        ])
        actionMenuProps.next(
          /** @type {import('@src/utils/game-interaction').ActionMenuProps} */ ({
            interactedMesh: card4
          })
        )
        expectIndicators([
          {
            id: `${card4.id}.stack-size`,
            size: 3,
            screenPosition: { x: 1143.16, y: 465.21 }
          },
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 904.84, y: 465.21 }
          }
        ])
      })

      it('has indicators when toggling visibility', () => {
        const [card1, , , , card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card4', 'card5'] })
        expectIndicators()
        toggleIndicators()
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 3,
            screenPosition: { x: 904.84, y: 465.21 }
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

      it('has feedback', async () => {
        /** @type {import('@src/3d/managers').FeedbackIndicator} */
        const indicator = { position: [1, 0, -1], action: 'draw' }
        managers.indicator.registerFeedback(indicator)
        await waitNextRender(scene)
        expectFeedbacks([indicator])
      })

      it('retains feedback for 3 seconds', async () => {
        /** @type {import('@src/3d/managers').FeedbackIndicator} */
        const indicator = { position: [1, 0, -1], action: 'rotate' }
        managers.indicator.registerFeedback(indicator)
        await waitNextRender(scene)
        expectFeedbacks([indicator])
        managers.indicator.onChangeObservable.notifyObservers([])
        await sleep(1100)
        await waitNextRender(scene)
        expectFeedbacks([indicator])
        await sleep(1100)
        await waitNextRender(scene)
        expectFeedbacks([indicator])
        await sleep(1100)
        await waitNextRender(scene)
        expectFeedbacks()
      })

      it('has indicators for each stackable mesh', async () => {
        const [card1, , card3, card4, card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card2', 'card4'] })
        card3
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card5'] })

        await waitNextRender(scene)
        expectIndicators([
          {
            id: `${card4.id}.stack-size`,
            size: 3,
            screenPosition: { x: 1024, y: 464.81 }
          },
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 1000.16, y: 465 }
          }
        ])
      })

      it('has no indicator for empty stacks', () => {
        const [card1, , card3, , card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card4', 'card5'] })
        card3.getBehaviorByName(StackBehaviorName)?.fromState({})
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 3,
            screenPosition: { x: 904.84, y: 465.21 }
          }
        ])
      })

      it('has no indicator when toggling visibility', () => {
        const [card1, , , , card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card4', 'card5'] })
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 3,
            screenPosition: { x: 904.84, y: 465.21 }
          }
        ])
        toggleIndicators()
        expectIndicators()
      })

      it('updates indicators on action', async () => {
        const [card1, , , , card5] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card4', 'card5'] })
        expectIndicators([
          {
            id: `${card5.id}.stack-size`,
            size: 3,
            screenPosition: { x: 904.84, y: 465.21 }
          }
        ])
        await card1.metadata.flipAll?.()
        expectIndicators([
          {
            id: `${card1.id}.stack-size`,
            size: 3,
            screenPosition: { x: 1024, y: 465.21 }
          }
        ])
      })

      it('has no player data on drop zones', async () => {
        const [card] = cards
        card.getBehaviorByName(AnchorBehaviorName)?.fromState({
          anchors: [{ id: 'anchor-0', playerId: players[0].id, snappedIds: [] }]
        })
        expectIndicators([
          {
            id: `${players[0].id}.drop-zone.anchor-0`,
            screenPosition: { x: 1024, y: 500.74 }
          }
        ])
      })

      it('updates indicators on hand resize', async () => {
        const [card1, , , card4, card5, card6] = cards
        card1
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card2', 'card4'] })
        card6
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['card5'] })

        const indicators = [
          {
            id: `${card4.id}.stack-size`,
            size: 3,
            screenPosition: { x: 1024, y: 464.81 }
          },
          {
            id: `${card5.id}.stack-size`,
            size: 2,
            screenPosition: { x: 1024, y: 360.58 }
          }
        ]

        await waitNextRender(scene)
        expectIndicators(indicators)

        await notifyHandResize(renderHeight * 0.6)
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
        card1.getBehaviorByName(AnchorBehaviorName)?.fromState({
          anchors: [{ id: '2', playerId: players[0].id, snappedIds: [] }]
        })
        card2.getBehaviorByName(AnchorBehaviorName)?.fromState({
          anchors: [{ id: '3', playerId: players[1].id, snappedIds: [] }]
        })
        expectIndicators([
          {
            id: `${players[0].id}.drop-zone.2`,
            player: players[0],
            screenPosition: { x: 1024, y: 500.74 }
          },
          {
            id: `${players[1].id}.drop-zone.3`,
            player: players[1],
            screenPosition: { x: 1048.13, y: 500.74 }
          }
        ])
      })
    })
  })

  function expectIndicators(
    /** @type {Partial<Record<String, ?> & import('@src/3d/managers').Indicator>[]} */ expected = []
  ) {
    expectObjectOnScreen(get(visibleIndicators$), expected)
  }

  function expectFeedbacks(
    /** @type {Partial<Record<String, ?> & import('@src/3d/managers').Indicator>[]} */ expected = []
  ) {
    expectObjectOnScreen(get(visibleFeedbacks$), expected)
  }

  function expectObjectOnScreen(
    /** @type {import('@src/3d/managers').Indicator[]} */ actuals,
    /** @type {Partial<Record<String, ?> & import('@src/3d/managers').Indicator>[]} */ expected = []
  ) {
    expect(actuals).toHaveLength(expected.length)
    for (const [
      rank,
      { screenPosition, id, mesh, ...otherProps }
    ] of expected.entries()) {
      const { mesh: actualMesh, ...actual } =
        /** @type {import('@src/3d/managers').Indicator & {mesh?: import('@babylonjs/core').Mesh}} */ (
          actuals[rank]
        )
      expect(actual, `indicator #${rank}`).toHaveProperty('id', id)
      expect(actual, `indicator #${rank}`).toEqual(
        expect.objectContaining(otherProps)
      )
      if (mesh) {
        expect(actualMesh?.id, `indicator #${rank} mesh`).toEqual(mesh?.id)
      }
      if (screenPosition) {
        expectScreenPosition(
          actual.screenPosition,
          screenPosition,
          `indicator #${rank}`
        )
      }
    }
  }

  async function notifyHandResize(/** @type {number} */ height) {
    getComputedStyle.mockImplementation(
      node =>
        /** @type {CSSStyleDeclaration} */ ({
          height: `${node === canvas ? renderHeight : height}px`
        })
    )
    // @ts-expect-error: resizeObservers are mocked
    window.resizeObservers[window.resizeObservers.length - 1].notify()
    await sleep(20)
  }
})
