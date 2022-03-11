import { BehaviorSubject, map, merge, of, withLatestFrom } from 'rxjs'
import { getMeshScreenPosition } from '../3d/utils'
import {
  currentCamera,
  controlledMeshes,
  actionMenuData,
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
  visible$,
  controlledMeshes,
  selectedMeshes,
  actionMenuData,
  currentCamera
).pipe(
  withLatestFrom(
    merge(of(new Map()), controlledMeshes),
    merge(of(new Set()), selectedMeshes),
    merge(of(null), actionMenuData)
  ),
  map(([, controlled, selected, menuData]) =>
    getDisplayedStacks(visible$.value, controlled, selected, menuData).map(
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

function getDisplayedStacks(allVisible, controlled, selected, menuData) {
  const stacks = getStacks(controlled)
  return allVisible
    ? stacks
    : menuData?.tapped && !selected.has(menuData.tapped)
    ? getContainingStack(stacks, menuData)
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

function getContainingStack(stacks, menuData) {
  return stacks.filter(({ metadata }) =>
    menuData.meshes.some(mesh => metadata.stack.includes(mesh))
  )
}
