import { BehaviorSubject, map, merge, of, withLatestFrom } from 'rxjs'

import { inputManager, selectionManager } from '../3d/managers'
import { getPixelDimension, observeDimension } from '../utils/dom'
import {
  actionMenuProps,
  indicators as indicators$,
  selectedMeshes
} from './game-engine'
import { gamePlayerById as gamePlayerById$ } from './game-manager'

const visible$ = new BehaviorSubject(true)
const handPosition$ = new BehaviorSubject(Number.POSITIVE_INFINITY)
const hoveredMesh$ = new BehaviorSubject()

let playerById = new Map()
gamePlayerById$.subscribe(value => (playerById = value))
let engine
let feedbackById = new Map()

/**
 * Initializes the indicators store with the hand DOM node.
 * @param {object} params - parameters, including:
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
 * @type {Observable<boolean>}
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
 * @type {Observable<import('../3d/managers').Indicator[]>}
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
    merge(of([]), indicators$),
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
 * @type {Observable<import('../3d/managers').Indicator[]>}
 */
export const visibleFeedbacks = merge(visible$, indicators$).pipe(
  withLatestFrom(merge(of([]), indicators$)),
  map(([, indicators]) =>
    visible$.value ? memorizeAndMergeFeedback(indicators) : []
  ),
  map(enrichWithPlayerData)
)

function getVisibleIndicators(
  allVisible,
  selected,
  menuProps,
  indicators,
  handPosition
) {
  return allVisible
    ? indicators.filter(
        ({ screenPosition, isFeedback }) =>
          !isFeedback &&
          screenPosition.y <= handPosition &&
          screenPosition.y > 10
      )
    : hasMenu(menuProps, selected)
    ? getMenuIndicators(menuProps, indicators)
    : getSelectedIndicators(selected, indicators)
}

function hasMenu(menuProps, selected) {
  return menuProps && !selected.has(menuProps.interactedMesh)
}

function getMenuIndicators(menuProps, indicators) {
  return indicators.filter(({ mesh }) => mesh === menuProps.interactedMesh)
}

function getSelectedIndicators(selected, indicators) {
  return indicators.filter(({ mesh }) => selected.has(mesh))
}

function enrichWithPlayerData(indicators) {
  return indicators.map(indicator => {
    if (indicator.playerId) {
      const player = playerById.get(indicator.playerId) ?? {}
      indicator.player = player
      indicator.playerId = undefined
    }
    return indicator
  })
}

function enrichWithHovered(indicators) {
  for (const indicator of indicators) {
    indicator.hovered = indicator.mesh === hoveredMesh$.value
  }
  return indicators
}

function enrichWithInteraction(indicators) {
  return indicators.map(indicator => ({
    ...indicator,
    onClick: indicator.mesh
      ? () => {
          const selected = indicator.mesh.metadata.stack ?? indicator.mesh
          if (selectionManager.meshes.has(indicator.mesh)) {
            selectionManager.unselect(selected)
          } else {
            selectionManager.select(selected)
          }
        }
      : null
  }))
}

function memorizeAndMergeFeedback(indicators) {
  const results = []
  const now = Date.now()
  for (const [id, feedback] of feedbackById) {
    if (now - feedback.start < 3000) {
      results.push(feedback)
    } else {
      feedbackById.delete(id)
    }
  }
  for (const indicator of indicators) {
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
