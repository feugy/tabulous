// @ts-check
// Keep this file free from @babylon (in)direct imports, to allow Svelte component referencing them
// Otherwise this would bloat production chunks with Babylonjs (1.6Mb uncompressed)
import {
  DetailBehaviorName,
  DrawBehaviorName,
  FlipBehaviorName,
  LockBehaviorName,
  QuantityBehaviorName,
  RandomBehaviorName,
  RotateBehaviorName,
  StackBehaviorName
} from '../behaviors/names'

/**
 * Action names defined in beheviors, attached to mesh metadata,
 * and that can be used in actionNamesByKey map.
 */
export const actionNames = /** @type {const} */ ({
  decrement: 'decrement',
  detail: 'detail',
  draw: 'draw',
  flip: 'flip',
  flipAll: 'flipAll',
  increment: 'increment',
  play: 'play',
  pop: 'pop',
  push: 'push',
  random: 'random',
  reorder: 'reorder',
  rotate: 'rotate',
  setFace: 'setFace',
  snap: 'snap',
  toggleLock: 'toggleLock',
  unsnap: 'unsnap'
})

/**
 * button ids triggered in game-interaction and used in actionNamesByButton map
 * @type {Record<string, import('@tabulous/server/graphql').ButtonName>}
 */
export const buttonIds = {
  button1: 'button1',
  button2: 'button2'
}

/**
 * Parse game data to build a map of supported action names by their shortcuts.
 * @param {import('@tabulous/types').Mesh[]} meshes - serialized meshes to be analyzed.
 * @param {import('@src/types').Translate} translate - translation
 * @returns map of supported action names by shortcut.
 */
export function buildActionNamesByKey(meshes, translate) {
  /** @type {Map<string, import('@tabulous/types').ActionName[]>} */
  const actionNamesByKey = new Map()
  let hasStackable = false
  let hasQuantifiable = false
  // makes sure all meshes are created
  for (const state of meshes) {
    if (state[FlipBehaviorName]) {
      actionNamesByKey.set(translate('shortcuts.flip'), [actionNames.flip])
    }
    if (state[RotateBehaviorName]) {
      actionNamesByKey.set(translate('shortcuts.rotate'), [actionNames.rotate])
    }
    if (state[StackBehaviorName]) {
      actionNamesByKey.set(translate('shortcuts.reorder'), [
        actionNames.reorder
      ])
      hasStackable = true
    }
    if (state[QuantityBehaviorName]) {
      hasQuantifiable = true
    }
    if (state[LockBehaviorName]) {
      actionNamesByKey.set(translate('shortcuts.toggleLock'), [
        actionNames.toggleLock
      ])
    }
    if (state[RandomBehaviorName]) {
      actionNamesByKey.set(translate('shortcuts.random'), [actionNames.random])
    }
    if (state[DrawBehaviorName]) {
      actionNamesByKey.set(translate('shortcuts.drawOrPlay'), [
        actionNames.draw,
        actionNames.play
      ])
    }
    if (state[DetailBehaviorName]) {
      actionNamesByKey.set(translate('shortcuts.detail'), [actionNames.detail])
    }
  }
  if (hasStackable || hasQuantifiable) {
    actionNamesByKey.set(
      translate('shortcuts.push'),
      /** @type {import('@tabulous/types').ActionName[]} */ (
        [
          hasStackable ? actionNames.push : undefined,
          hasQuantifiable ? actionNames.increment : undefined
        ].filter(Boolean)
      )
    )
    actionNamesByKey.set(
      translate('shortcuts.pop'),
      /** @type {import('@tabulous/types').ActionName[]} */ (
        [
          hasStackable ? actionNames.pop : undefined,
          hasQuantifiable ? actionNames.decrement : undefined
        ].filter(Boolean)
      )
    )
  }
  return actionNamesByKey
}
