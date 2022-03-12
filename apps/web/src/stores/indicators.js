import { BehaviorSubject, map, merge, of, withLatestFrom } from 'rxjs'
import { getMeshScreenPosition } from '../3d/utils'
import {
  action,
  actionMenuProps,
  currentCamera,
  controlledMeshes,
  selectedMeshes
} from './game-engine'

const visible$ = new BehaviorSubject(false)

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
 */

/**
 * Emits visible indicators.
 * @type {Observable<StackIndicator & import('../3d/utils').ScreenPosition>}
 */
export const indicators = merge(
  action,
  visible$,
  selectedMeshes,
  actionMenuProps,
  currentCamera
).pipe(
  withLatestFrom(
    merge(of(new Map()), controlledMeshes),
    merge(of(new Set()), selectedMeshes),
    merge(of(null), actionMenuProps)
  ),
  map(([, controlled, selected, menuProps]) =>
    getDisplayedStacks(visible$.value, controlled, selected, menuProps).map(
      mesh => ({
        id: mesh.id,
        size: mesh.metadata.stack.length,
        ...getMeshScreenPosition(
          mesh.metadata.stack[mesh.metadata.stack.length - 1]
        )
      })
    )
  )
)

function getStacks(controlled) {
  const stacks = []
  for (const [, mesh] of controlled) {
    if (isStackBase(mesh)) {
      stacks.push(mesh)
    }
  }
  return stacks
}

function getDisplayedStacks(allVisible, controlled, selected, menuProps) {
  if (!allVisible && selected.size === 0 && !menuProps) {
    return []
  }
  const stacks = getStacks(controlled)
  return allVisible
    ? stacks
    : menuProps?.meshes.every(mesh => !selected.has(mesh))
    ? getContainingStack(stacks, menuProps)
    : getSelectedStacks(stacks, selected)
}

function isStackBase(mesh) {
  return (
    mesh?.metadata?.stack?.length > 1 && mesh.metadata.stack[0].id === mesh.id
  )
}

function getSelectedStacks(stacks, selected) {
  return stacks.filter(mesh => selected.has(mesh))
}

function getContainingStack(stacks, menuProps) {
  return stacks.filter(({ metadata }) =>
    menuProps.meshes.some(mesh => metadata.stack.includes(mesh))
  )
}
