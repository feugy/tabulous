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
 * @property {number} x - horizontal coordinate.
 * @property {number} y - vertical coordinate.
 */

/**
 * Emits visible stack indicators.
 * @type {Observable<StackIndicator & import('../3d/utils').ScreenPosition>}
 */
export const stackIndicators = merge(
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
  return indicators.map(({ screenPosition, ...props }) => ({
    ...props,
    ...screenPosition
  }))
} /*allVisible
    ? indicators
    : menuProps?.meshes.every(mesh => !selected.has(mesh))
    ? getContainingStack(stacks, menuProps)
    : getSelectedIndicators(selected, indicators)
}

function isStackBase(mesh) {
  return (
    mesh?.metadata?.stack?.length > 1 && mesh.metadata.stack[0].id === mesh.id
  )
}

function getSelectedIndicators(selected, indicators) {
  return indicators.filter(({ mesh }) => selected.has(mesh))
}

function getContainingStack(stacks, menuProps) {
  return stacks.filter(({ metadata }) =>
    menuProps.meshes.some(mesh => metadata.stack.includes(mesh))
  )
}*/
