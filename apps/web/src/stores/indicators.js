import { BehaviorSubject, map, merge, of, withLatestFrom } from 'rxjs'
import { getPixelDimension, observeDimension } from '../utils/dom'
import {
  actionMenuProps,
  indicators as indicators$,
  selectedMeshes
} from './game-engine'
import { gamePlayerById as gamePlayerById$ } from './game-manager'

const visible$ = new BehaviorSubject(true)
const handPosition$ = new BehaviorSubject(Number.POSITIVE_INFINITY)

let playerById = new Map()
gamePlayerById$.subscribe(value => (playerById = value))
let engine
let currentFeedbackById = new Map()

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
  currentFeedbackById = new Map()
  const subscription = dimension$.subscribe(({ height }) => {
    const { height: totalHeight } = getPixelDimension(canvas)
    handPosition$.next(totalHeight - height)
  })
  engine.onDisposeObservable.addOnce(() => {
    disconnect()
    subscription.unsubscribe()
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
 * Emits visible indicators:
 * - all of them when visible is set,
 * - the ones above selected meshes,
 * - the ones above mesh with action menu.
 * @type {Observable<import('../3d/managers').Indicator[]>}
 */
export const visibleIndicators = merge(
  visible$,
  selectedMeshes,
  actionMenuProps,
  indicators$,
  handPosition$
).pipe(
  withLatestFrom(
    merge(of(new Set()), selectedMeshes),
    merge(of(null), actionMenuProps),
    merge(of([]), indicators$).pipe(map(memorizeFeedback)),
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
        ({ screenPosition }) => screenPosition.y <= handPosition
      )
    : hasMenu(menuProps, selected)
    ? getMenuIndicators(menuProps, indicators)
    : getSelectedIndicators(selected, indicators)
}

function hasMenu(menuProps, selected) {
  return menuProps && !selected.has(menuProps.interactedMesh)
}

function getMenuIndicators(menuProps, indicators) {
  return indicators.filter(
    ({ isFeedback, mesh }) => isFeedback || mesh === menuProps.interactedMesh
  )
}

function getSelectedIndicators(selected, indicators) {
  return indicators.filter(
    ({ isFeedback, mesh }) => isFeedback || selected.has(mesh)
  )
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

function memorizeFeedback(indicators) {
  const results = []
  const now = Date.now()
  for (const indicator of indicators) {
    if (indicator.isFeedback) {
      if (!currentFeedbackById.has(indicator.id)) {
        currentFeedbackById.set(indicator.id, indicator)
        indicator.start = now
      }
    } else {
      results.push(indicator)
    }
  }
  for (const [id, feedback] of currentFeedbackById) {
    if (now - feedback.start < 3000) {
      results.push(feedback)
    } else {
      currentFeedbackById.delete(id)
    }
  }
  return results
}
