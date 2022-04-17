import { BehaviorSubject, map, merge, of, withLatestFrom } from 'rxjs'
import {
  actionMenuProps,
  indicators as indicators$,
  selectedMeshes
} from './game-engine'
import { currentGame as currentGame$ } from './game-manager'

const visible$ = new BehaviorSubject(true)

let playerById = new Map()

currentGame$
  .pipe(
    map(
      game => new Map((game?.players ?? []).map(player => [player.id, player]))
    )
  )
  .subscribe(value => {
    playerById = value
  })

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
  indicators$
).pipe(
  withLatestFrom(
    merge(of(new Set()), selectedMeshes),
    merge(of(null), actionMenuProps),
    merge(of([]), indicators$)
  ),
  map(([, selected, menuProps, indicators]) =>
    getVisibleIndicators(visible$.value, selected, menuProps, indicators)
  ),
  map(enrichWithPlayerData)
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
