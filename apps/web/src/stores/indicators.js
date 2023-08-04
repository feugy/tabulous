// @ts-check
/**
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@src/3d/managers/indicator').Indicator} Indicator
 * @typedef {import('@src/3d/managers/indicator').ManagedIndicator} ManagedIndicator
 * @typedef {import('@src/3d/managers/indicator').ManagedPointer} ManagedPointer
 * @typedef {import('@src/3d/managers/indicator').ManagedFeedback} ManagedFeedback
 * @typedef {import('@src/stores/game-manager').Player} Player
 * @typedef {import('@src/utils/game-interaction').ActionMenuProps} ActionMenuProps
 */
/**
 * @template T
 * @typedef {import('@src/types').ArrayItem<T>} ArrayItem
 */
/**
 * @template T
 * @typedef {import('@src/types').Observed<T>} Observed
 */

import { BehaviorSubject, map, merge, of, withLatestFrom } from 'rxjs'

import { inputManager, selectionManager } from '../3d/managers'
import { getPixelDimension, observeDimension } from '../utils/dom'
import {
  actionMenuProps,
  indicators as indicators$,
  selectedMeshes
} from './game-engine'
import { gamePlayerById as gamePlayerById$ } from './game-manager'

/** @typedef {ArrayItem<Observed<typeof visibleIndicators>>} VisibleIndicator */
/** @typedef {ArrayItem<Observed<typeof visibleFeedbacks>>} VisibleFeedback */

const visible$ = new BehaviorSubject(true)
const handPosition$ = new BehaviorSubject(Number.POSITIVE_INFINITY)
const hoveredMesh$ = new BehaviorSubject(/** @type {?Mesh} */ (null))

/** @type {Map<string, Player>} */
let playerById = new Map()
gamePlayerById$.subscribe(value => (playerById = value))
let engine
let feedbackById = new Map()

/**
 * Initializes the indicators store with the hand DOM node.
 * @param {object} params - parameters
 * @param {Engine} params.engine - 3D engine.
 * @param {HTMLCanvasElement} params.canvas - HTML canvas used to display the scene.
 * @param {HTMLElement} params.hand - HTML element holding hand.
 */
export function initIndicators(params) {
  engine = params.engine
  const { canvas, hand } = params
  const { dimension$, disconnect } = observeDimension(hand)
  feedbackById = new Map()
  const dimensionSubscription = dimension$.subscribe(({ height }) => {
    const { height: totalHeight } = getPixelDimension(canvas)
    handPosition$.next(totalHeight - height)
  })
  const hoverObserver = inputManager.onHoverObservable.add(({ type, mesh }) => {
    hoveredMesh$.next(type === 'hoverStop' ? null : mesh)
  })
  engine.onDisposeObservable.addOnce(() => {
    disconnect()
    dimensionSubscription.unsubscribe()
    inputManager.onHoverObservable.remove(hoverObserver)
  })
}

/**
 * Emits whenever the indicators are shown or hidden.
 */
export const areIndicatorsVisible = visible$.asObservable()

/**
 * Shows or hides game indicators.
 */
export async function toggleIndicators() {
  visible$.next(!visible$.value)
}

/**
 * Emits visible indicators (but feedback):
 * - all of them when `visible` is set,
 * - the ones above selected meshes,
 * - the ones above mesh with action menu.
 */
export const visibleIndicators = merge(
  visible$,
  selectedMeshes,
  actionMenuProps,
  indicators$,
  handPosition$,
  hoveredMesh$
).pipe(
  withLatestFrom(
    merge(of(new Set()), selectedMeshes),
    merge(of(null), actionMenuProps),
    merge(of(/** @type {Indicator[]} */ ([])), indicators$),
    handPosition$
  ),
  map(([, selected, menuProps, indicators, handPosition]) =>
    getVisibleIndicators(
      visible$.value,
      selected,
      menuProps,
      indicators,
      handPosition
    )
  ),
  map(enrichWithHovered),
  map(enrichWithPlayerData),
  map(enrichWithInteraction)
)

/**
 * Emits visible feedbacks, dependeing on `visible` state.
 */
export const visibleFeedbacks = merge(visible$, indicators$).pipe(
  withLatestFrom(merge(of([]), indicators$)),
  map(([, indicators]) =>
    visible$.value ? memorizeAndMergeFeedback(indicators) : []
  ),
  map(enrichWithPlayerData)
)

/**
 * @param {boolean} allVisible - whether all indicators are visible.
 * @param {Set<Mesh>} selected - list of currently selected meshes.
 * @param {?ActionMenuProps} menuProps - current menu items, if any.
 * @param {Indicator[]} indicators - list of all indicators.
 * @param {number} handPosition - position of the limit between main and hand scene.
 */
function getVisibleIndicators(
  allVisible,
  selected,
  menuProps,
  indicators,
  handPosition
) {
  return /** @type {(ManagedPointer|ManagedIndicator)[]} */ (
    allVisible
      ? indicators.filter(
          ({ screenPosition, isFeedback }) =>
            !isFeedback &&
            screenPosition.y <= handPosition &&
            screenPosition.y > 10
        )
      : hasMenu(menuProps, selected)
      ? getMenuIndicators(menuProps, indicators)
      : getSelectedIndicators(selected, indicators)
  )
}

function hasMenu(
  /** @type {?ActionMenuProps} */ menuProps,
  /** @type {Set<Mesh>} */ selected
) {
  return menuProps !== null && !selected.has(menuProps.interactedMesh)
}

function getMenuIndicators(
  /** @type {?ActionMenuProps} */ menuProps,
  /** @type {Indicator[]} */ indicators
) {
  return indicators.filter(indicator =>
    'mesh' in indicator ? indicator.mesh === menuProps?.interactedMesh : false
  )
}

function getSelectedIndicators(
  /** @type {Set<Mesh>} */ selected,
  /** @type {Indicator[]} */ indicators
) {
  return indicators.filter(indicator =>
    'mesh' in indicator ? selected.has(indicator.mesh) : false
  )
}

/**
 * @template {Indicator} T
 * @param {T[]} indicators
 * @returns {(T & { player?: Player })[]}
 */
function enrichWithPlayerData(indicators) {
  for (const raw of indicators) {
    const indicator = /** @type {T & { player?: Player }} */ (raw)
    if ('playerId' in indicator && indicator.playerId) {
      const player = playerById.get(indicator.playerId) ?? {
        id: indicator.playerId,
        username: '',
        currentGameId: null,
        isGuest: false,
        isOwner: false,
        isHost: false,
        playing: false
      }
      indicator.player = player
      indicator.playerId = undefined
    }
  }
  return indicators
}

/**
 * @template {Indicator} T
 * @param {T[]} indicators
 * @returns {(T & { hovered?: boolean })[]}
 */
function enrichWithHovered(indicators) {
  for (const raw of indicators) {
    const indicator = /** @type {T & { hovered?: boolean }} */ (raw)
    if ('mesh' in indicator) {
      indicator.hovered = indicator.mesh === hoveredMesh$.value
    }
  }
  return indicators
}

/**
 * @template {Indicator} T
 * @param {T[]} indicators
 * @returns {(T & { onClick?: () => void })[]}
 */
function enrichWithInteraction(indicators) {
  for (const raw of indicators) {
    const indicator = /** @type {T & { onClick?: () => void }} */ (raw)
    if ('mesh' in indicator && indicator.mesh) {
      indicator.onClick = () => {
        const selected = indicator.mesh.metadata.stack ?? indicator.mesh
        if (selectionManager.meshes.has(indicator.mesh)) {
          selectionManager.unselect(selected)
        } else {
          selectionManager.select(selected)
        }
      }
    }
  }
  return indicators
}

/**
 * @param {Indicator[]} indicators
 * @returns {(ManagedFeedback & { start?: number })[]}
 */
function memorizeAndMergeFeedback(indicators) {
  /** @type {(ManagedFeedback & { start?: number })[]} */
  const results = []
  const now = Date.now()
  for (const [id, feedback] of feedbackById) {
    if (now - feedback.start < 3000) {
      results.push(feedback)
    } else {
      feedbackById.delete(id)
    }
  }
  for (const raw of indicators) {
    const indicator = /** @type {ManagedFeedback & { start?: number }} */ (raw)
    if (indicator.isFeedback) {
      if (!feedbackById.has(indicator.id)) {
        indicator.start = now
        results.push(indicator)
        feedbackById.set(indicator.id, indicator)
      }
    }
  }
  return results
}
