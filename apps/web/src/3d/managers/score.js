import { makeLogger } from '../../utils'
import { actionNames } from '../utils/actions'

const logger = makeLogger('rules')

const { snap, unsnap } = actionNames

export class ScoreManager {
  /**
   * Builds a manager to orchestrate replaying, backward and forward, history records.
   * Invokes init() before any other function.
   * @param {object} params - parameters, including:
   * @param {import('@babylonjs/core').Engine} params.engine - 3d engine.
   */
  constructor({ engine }) {
    /** game engin. */
    this.engine = engine
    /** @type {import('@babylonjs/core').Observer<import('@src/3d/managers').ActionOrMove>?} */
    this.actionObserver
    this.engine.onDisposeObservable.addOnce(() => {
      this.managers?.control.onActionObservable.remove(this.actionObserver)
    })
  }

  /**
   * Initializes with game rules.
   * Connects to the control manager to evaluate rules.
   * @param {object} params - parameters, including:
   * @param {import('@src/3d/managers').Managers} params.managers - current managers.
   */
  init({ managers }) {
    this.managers = managers
    this.actionObserver = managers.control.onActionObservable.add(action =>
      evaluate(this, action)
    )
    logger.debug('rules manager initialized')
  }
}

async function evaluate(
  /** @type {ScoreManager} */ { engine },
  /** @type {import('@src/3d/managers').ActionOrMove} */ action
) {
  if (!('fn' in action)) {
    return
  }
  const state = engine.serialize()
  // 6-takes
  if (
    (action.fn === snap || action.fn === unsnap) &&
    action.meshId === 'board'
  ) {
    const { snappedId } = findAnchor('score-player-1', state.meshes)
    const snapped = findMesh(snappedId, state.meshes, false)
    console.log('player 1', snapped?.id)
  }
}

function findAnchor(path, meshes, throwOnMiss = true) {
  let candidates = [...(meshes ?? [])]
  let anchor
  for (let leg of path.split('.')) {
    const match = findMeshAndAnchor(leg, candidates, throwOnMiss)
    if (!match) {
      return null
    }
    candidates = meshes.filter(({ id }) => id === match.anchor.snappedId)
    anchor = match.anchor
  }
  return anchor ?? null
}

function findMeshAndAnchor(anchorId, meshes, throwOnMiss = true) {
  for (const mesh of meshes) {
    for (const anchor of mesh.anchorable?.anchors ?? []) {
      if (anchor.id === anchorId) {
        return { mesh, anchor }
      }
    }
  }
  if (throwOnMiss) {
    throw new Error(`No anchor with id ${anchorId}`)
  }
  return null
}

function findMesh(id, meshes, throwOnMiss = true) {
  const mesh = meshes?.find(mesh => mesh.id === id) ?? null
  if (throwOnMiss && !mesh) {
    throw new Error(`No mesh with id ${id}`)
  }
  return mesh
}
