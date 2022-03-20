import { BehaviorSubject, map, merge, of, withLatestFrom } from 'rxjs'
import {
  actionMenuProps,
  indicators as indicators$,
  selectedMeshes
} from './game-engine'

const visible$ = new BehaviorSubject(true)

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
 * @typedef {object} StackIndicator details about a stack of meshes
 * @property {string} id - base mesh id.
 * @property {number} size - number of stacked meshes.
 * @property {import('../3d/utils').ScreenPosition} screenPosition - position (screen coordinates).
 */

/**
 * Emits visible stack indicators.
 * @type {Observable<StackIndicator>}
 */
export const stackSizes = merge(
  visible$,
  selectedMeshes,
  actionMenuProps,
  indicators$
).pipe(
  withLatestFrom(
    merge(of(new Set()), selectedMeshes),
    merge(of(null), actionMenuProps),
    merge(of([]), indicators$)
  ),
  map(([, selected, menuProps, indicators]) =>
    getVisibleIndicators(visible$.value, selected, menuProps, indicators)
  )
)

function getVisibleIndicators(allVisible, selected, menuProps, indicators) {
  if (!allVisible && selected.size === 0 && !menuProps) {
    return []
  }
  return allVisible
    ? indicators
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
