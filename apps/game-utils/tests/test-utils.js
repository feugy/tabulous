// @ts-check
import { expect } from 'vitest'

export function expectStackedOnSlot(
  /** @type {import('@tabulous/types').Mesh[]} */ meshes,
  /** @type {import('@tabulous/types').Slot|undefined} */ slot,
  count = slot?.count ?? 1
) {
  const stack = meshes.find(
    ({ stackable }) => stackable?.stackIds?.length === count - 1
  )
  expect(stack).toBeDefined()
  const stackedMeshes = meshes.filter(
    ({ id }) => stack?.stackable?.stackIds?.includes(id) || id === stack?.id
  )
  expect(stackedMeshes).toHaveLength(count)
  expect(
    stackedMeshes.every(
      ({ x, y, z }) => x === slot?.x && y === slot?.y && z === slot?.z
    )
  ).toBe(true)
  return /** @type {import('@tabulous/types').Mesh} */ (stack)
}

export function expectSnappedByName(
  /** @type {import('@tabulous/types').Mesh[]} */ meshes,
  /** @type {string} */ name,
  /** @type {import('@tabulous/types').Anchor|undefined} */ anchor
) {
  const candidates = meshes.filter(mesh => 'name' in mesh && name === mesh.name)
  expect(candidates).toHaveLength(1)
  expect(anchor?.snappedId).toEqual(candidates[0].id)
}

/**
 * Performs a deep clone, using JSON parse and stringify
 * This is a slow, destructive (functions, Date and Regex are lost) method, only suitable in tests
 * @template {object} T
 * @param {T} object - cloned object
 * @returns {T} a clone
 */
export function cloneAsJSON(object) {
  return JSON.parse(JSON.stringify(object))
}

/**
 * @param {Partial<import('@tabulous/types').StartedGame>} [overrides = {}] - optional game overrides.
 * @returns {import('@tabulous/types').StartedGame} the test game.
 */
export function makeGame(overrides = {}) {
  return {
    id: 'test',
    kind: 'playground',
    name: 'Playground',
    locales: { fr: { title: 'Terrain de jeu' } },
    created: Date.now(),
    availableSeats: 4,
    ownerId: 'admin',
    meshes: [],
    hands: [],
    messages: [],
    cameras: [],
    history: [],
    preferences: [],
    playerIds: [],
    guestIds: [],
    ...overrides
  }
}
