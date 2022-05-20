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

/**
 * Initializes the indicators store with the hand DOM node.
 * @param {object} params - parameters, including:
 * @param {HTMLCanvasElement} params.canvas - HTML canvas used to display the scene.
 * @param {HTMLElement} params.hand - HTML element holding hand.
 */
export function initIndicators({ engine, canvas, hand }) {
  const { dimension$, disconnect } = observeDimension(hand)
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
 * Positioned indicator above a given mesh.
 * Other properties can be used to convey specific data
 * @typedef {object} Indicator positioned mesh indicators
 * @property {string} id - base mesh id.
 * @property {import('../3d/utils').ScreenPosition} screenPosition - position (screen coordinates).
 */

/**
 * Emits visible indicators:
 * - all of them when visible is set,
 * - the ones above selected meshes,
 * - the ones above mesh with action menu.
 * @type {Observable<Indicator>}
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
  map(enrichWithPlayerData)
)

function getVisibleIndicators(
  allVisible,
  selected,
  menuProps,
  indicators,
  handPosition
) {
  if (!allVisible && selected.size === 0 && !menuProps) {
    return []
  }
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
  const indicator = indicators.find(
    ({ mesh }) => mesh === menuProps.interactedMesh
  )
  return indicator ? [indicator] : []
}

function getSelectedIndicators(selected, indicators) {
  return indicators.filter(({ mesh }) => selected.has(mesh))
}

function enrichWithPlayerData(indicators) {
  return indicators.map(indicator => {
    if (indicator.playerId && !indicator.name) {
      // do not erase indicator id with player's id
      // eslint-disable-next-line no-unused-vars
      const { id, ...playerData } = playerById.get(indicator.playerId) ?? {}
      Object.assign(indicator, playerData)
    }
    return indicator
  })
}
