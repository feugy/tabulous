// @ts-check
import { BehaviorSubject, map, merge, of, withLatestFrom } from 'rxjs'

import { getPixelDimension, observeDimension } from '../utils/dom'
import {
  actionMenuProps,
  indicators as indicators$,
  selectedMeshes
} from './game-engine'
import { gamePlayerById as gamePlayerById$ } from './game-manager'

/** @typedef {import('@src/types').ArrayItem<import('@src/types').Observed<typeof visibleIndicators>>} VisibleIndicator */
/** @typedef {import('@src/types').ArrayItem<import('@src/types').Observed<typeof visibleFeedbacks>>} VisibleFeedback */

const visible$ = new BehaviorSubject(true)
const handPosition$ = new BehaviorSubject(Number.POSITIVE_INFINITY)
const hoveredMesh$ = new BehaviorSubject(
  /** @type {?import('@babylonjs/core').Mesh} */ (null)
)

/** @type {Map<string, import('@src/stores').PlayerWithPref>} */
let playerById = new Map()
gamePlayerById$.subscribe(value => (playerById = value))
/** @type {import('@babylonjs/core').Engine} */
let engine
let feedbackById = new Map()

/**
 * Initializes the indicators store with the hand DOM node.
 * @param {object} params - parameters
 * @param {import('@babylonjs/core').Engine} params.engine - 3D engine.
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
  const hoverObserver = engine.managers.input.onHoverObservable.add(
    ({ type, mesh }) => {
      hoveredMesh$.next(type === 'hoverStop' ? null : mesh)
    }
  )
  engine.onDisposeObservable.addOnce(() => {
    disconnect()
    dimensionSubscription.unsubscribe()
    engine.managers.input.onHoverObservable.remove(hoverObserver)
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
    merge(
      of(/** @type {import('@src/3d/managers').Indicator[]} */ ([])),
      indicators$
    ),
    handPosition$,
    hoveredMesh$
  ),
  map(([, selected, menuProps, indicators, handPosition, hovered]) =>
    getVisibleIndicators(
      visible$.value,
      selected,
      menuProps,
      indicators,
      handPosition,
      hovered
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
 * @param {Set<import('@babylonjs/core').Mesh>} selected - list of currently selected meshes.
 * @param {?import('@src/utils/game-interaction').ActionMenuProps} menuProps - current menu items, if any.
 * @param {import('@src/3d/managers').Indicator[]} indicators - list of all indicators.
 * @param {number} handPosition - position of the limit between main and hand scene.
 * @param {?import('@babylonjs/core').Mesh} hovered - currently hovered mesh.
 */
function getVisibleIndicators(
  allVisible,
  selected,
  menuProps,
  indicators,
  handPosition,
  hovered
) {
  return /** @type {(import('@src/3d/managers').ManagedPointer|import('@src/3d/managers').ManagedIndicator)[]} */ (
    allVisible
      ? indicators.filter(
          ({ screenPosition, isFeedback }) =>
            !isFeedback &&
            screenPosition.y <= handPosition &&
            screenPosition.y > 10
        )
      : hasMenu(menuProps, selected)
      ? getMenuIndicators(menuProps, indicators)
      : getSelectedIndicators(hovered, selected, indicators)
  )
}

function hasMenu(
  /** @type {?import('@src/utils/game-interaction').ActionMenuProps} */ menuProps,
  /** @type {Set<import('@babylonjs/core').Mesh>} */ selected
) {
  return menuProps !== null && !selected.has(menuProps.interactedMesh)
}

function getMenuIndicators(
  /** @type {?import('@src/utils/game-interaction').ActionMenuProps} */ menuProps,
  /** @type {import('@src/3d/managers').Indicator[]} */ indicators
) {
  return indicators.filter(indicator =>
    'mesh' in indicator ? indicator.mesh === menuProps?.interactedMesh : false
  )
}

function getSelectedIndicators(
  /** @type {?import('@babylonjs/core').Mesh} */ hovered,
  /** @type {Set<import('@babylonjs/core').Mesh>} */ selected,
  /** @type {import('@src/3d/managers').Indicator[]} */ indicators
) {
  return indicators.filter(indicator =>
    'mesh' in indicator
      ? hovered === indicator.mesh || selected.has(indicator.mesh)
      : false
  )
}

/**
 * @template {import('@src/3d/managers').Indicator} T
 * @param {T[]} indicators
 * @returns {(T & { player?: import('@src/stores').PlayerWithPref })[]}
 */
function enrichWithPlayerData(indicators) {
  for (const raw of indicators) {
    const indicator =
      /** @type {T & { player?: import('@src/stores').PlayerWithPref }} */ (raw)
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
 * @template {import('@src/3d/managers').Indicator} T
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
 * @template {import('@src/3d/managers').Indicator} T
 * @param {T[]} indicators
 * @returns {(T & { onClick?: () => void })[]}
 */
function enrichWithInteraction(indicators) {
  for (const raw of indicators) {
    const indicator = /** @type {T & { onClick?: () => void }} */ (raw)
    if ('mesh' in indicator && indicator.mesh) {
      indicator.onClick = () => {
        const selected = indicator.mesh.metadata.stack ?? indicator.mesh
        const { selection } = engine.managers
        if (selection.meshes.has(indicator.mesh)) {
          selection.unselect(selected)
        } else {
          selection.select(selected)
        }
      }
    }
  }
  return indicators
}

/**
 * @param {import('@src/3d/managers').Indicator[]} indicators
 */
function memorizeAndMergeFeedback(indicators) {
  /** @type {(import('@src/3d/managers').ManagedFeedback & { start?: number })[]} */
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
    const indicator =
      /** @type {import('@src/3d/managers').ManagedFeedback & { start?: number }} */ (
        raw
      )
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
