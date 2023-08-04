// @ts-check
/**
 * @typedef {import('@babylonjs/core').LinesMesh} LinesMesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/utils').ScreenPosition} ScreenPosition
 */

import { Axis, Space } from '@babylonjs/core/Maths/math.axis.js'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder.js'
import { ExtrudeShape } from '@babylonjs/core/Meshes/Builders/shapeBuilder.js'
import { Mesh } from '@babylonjs/core/Meshes/mesh.js'
import { Observable } from '@babylonjs/core/Misc/observable.js'

import { makeLogger } from '../../utils/logger'
import { isMeshLocked } from '../utils/behaviors'
import { sortByElevation } from '../utils/gravity'
import { isContaining } from '../utils/mesh'
import { screenToGround } from '../utils/vector'
import { handManager } from './hand'

const logger = makeLogger('selection')

class SelectionManager {
  /**
   * Creates a manager to manages mesh selection:
   * - draw a selection box (a single rectangle on the table)
   * - select all meshes contained in the selection box, highlighting them
   * - clear previous selection
   */
  constructor() {
    // we need to keep this set immutable, because it is referenced when adding to it
    const meshes = new Set()
    /** @type {Set<Mesh>} meshes - active selection of meshes. */
    this.meshes
    Object.defineProperty(this, 'meshes', { get: () => meshes })
    /** @type {Observable<Set<Mesh>>} emits when selection is modified. */
    this.onSelectionObservable = new Observable()
    /** @type {Scene} */
    this.scene
    /** @type {Scene} */
    this.handScene
    /** @type {Color4} */
    this.color = Color4.FromHexString('#00ff00')
    /** @protected @type {?LinesMesh} */
    this.box = null
    /** @protected @type {boolean} */
    this.skipNotify = false
    /** @protected @type {Map<string, Set<Mesh>>} */
    this.selectionByPeerId = new Map()
    /** @protected @type {Map<string, Color4>} */
    this.colorByPlayerId = new Map()
  }

  /**
   * Gives a scene to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - scene attached to.
   * @param {Scene} params.handScene - scene for meshes in hand.
   */
  init({ scene, handScene }) {
    this.scene = scene
    this.handScene = handScene
    this.color = Color4.FromHexString('#00ff00ff')
    this.colorByPlayerId = new Map()
  }

  /**
   * Updates colors to reflect players in game.
   * @param {string} playerId - current player id, to find selection box color.
   * @param {Map<string, string>} colorByPlayerId - map of hexadecimal color strings used for selection box, and selected mesh overlay, by player id.
   */
  updateColors(playerId, colorByPlayerId) {
    this.colorByPlayerId = new Map(
      [...colorByPlayerId.entries()].map(([playerId, color]) => [
        playerId,
        Color4.FromHexString(color)
      ])
    )
    this.color = /** @type {Color4} */ (this.colorByPlayerId.get(playerId))
  }

  /**
   * Draws selection box between two points (in screen coordinates)
   * @param {ScreenPosition} start - selection box's start screen position.
   * @param {ScreenPosition} end - selection box's end screen position.
   */
  drawSelectionBox(start, end) {
    if (!this.scene) return
    logger.debug({ start, end }, `draw selection box`)
    const scene = handManager.isPointerInHand(start)
      ? this.handScene
      : this.scene

    this.box?.dispose()
    // TODO what if some points are null?
    const points = /** @type {Vector3[]} */ ([
      screenToGround(scene, start),
      screenToGround(scene, { x: start.x, y: end.y }),
      screenToGround(scene, end),
      screenToGround(scene, { x: end.x, y: start.y })
    ])
    points.push(points[0].clone())

    this.box = CreateLines(
      'selection-hint',
      {
        points,
        colors: Array.from({ length: 6 }, () => this.color)
      },
      scene
    )
    // ensure the box to be displayed "in front of" all other meshes
    this.box.renderingGroupId = 2

    // dynamically assign selectInBox function to keep start and end in scope
    this.selectWithinBox = () => {
      this.box?.dispose()
      // extrude a polygon from the lines, but since extrusion goes along Z axis,
      // rotate the points first
      const position = /** @type {Vector3} */ (
        screenToGround(scene, {
          x: start.x + (end.x - start.x) / 2,
          y: start.y + (end.y - start.y) / 2
        })
      )
      const rotation = Quaternion.RotationAxis(Axis.X, Math.PI / 2)
      for (const point of points) {
        point.rotateByQuaternionAroundPointToRef(rotation, position, point)
      }
      const box = ExtrudeShape(
        'selection-box',
        {
          shape: points,
          path: [Vector3.Zero(), new Vector3(0, 0, 20)],
          sideOrientation: Mesh.DOUBLESIDE
        },
        scene
      )
      // and finally rotate the extruded polygon back
      box.setPivotPoint(position, Space.WORLD)
      box.rotate(Axis.X, Math.PI / -2)
      box.position.y = -5
      box.visibility = 0
      box.isPickable = false
      box.isHittable = false

      if (getFirstSelected(this)?.getScene() !== scene) {
        this.skipNotify = true
        this.clear()
      }
      const allSelections = [this.meshes, ...this.selectionByPeerId.values()]
      for (const mesh of scene.meshes) {
        if (mesh.isPickable && isContaining(box, mesh)) {
          addToSelection(
            allSelections,
            this.meshes,
            this.onSelectionObservable,
            mesh,
            this.color
          )
        }
      }
      reorderSelection(this)

      logger.info({ start, end, meshes: this.meshes }, `new multiple selection`)
      box.dispose()
    }
  }

  /**
   * Selects all mesh contained in the selection box, disposing the box
   */
  selectWithinBox() {}

  /**
   * Adds meshes into selection (if not already in).
   * Ignores mesh already selected by other players.
   * Recursively inculdes anchored meshes.
   * @param {Mesh[]|Mesh} meshes - mesh(es) added to the active selection.
   * @param {Color4} [color] - color used to highlight mesh, default to manager's color.
   */
  select(meshes, color) {
    if (!Array.isArray(meshes)) {
      meshes = [meshes]
    }
    const allSelections = [this.meshes, ...this.selectionByPeerId.values()]
    const oldSize = this.meshes.size
    for (const mesh of meshes) {
      if (mesh) {
        addToSelection(
          allSelections,
          this.meshes,
          this.onSelectionObservable,
          mesh,
          color ?? this.color
        )
      }
    }
    if (this.meshes.size !== oldSize) {
      reorderSelection(this)
    }
  }

  /**
   * Removes meshes from the selection, including anchored meshes.
   * Ignores meshes selected by other players.
   * @param {Mesh[]|Mesh} meshes - mesh(es) to remove from the active selection.
   * @returns {void}
   */
  unselect(meshes) {
    if (!Array.isArray(meshes)) {
      meshes = [meshes]
    }
    const unselected = []
    const oldSize = this.meshes.size
    const otherSelections = [...this.selectionByPeerId.values()]
    for (const mesh of meshes) {
      if (!otherSelections.find(selection => selection.has(mesh))) {
        unselected.push(mesh, ...findSnapped(mesh))
      }
    }
    for (const mesh of unselected) {
      removeFromSelection(this.meshes, mesh)
    }
    if (this.meshes.size !== oldSize) {
      reorderSelection(this)
    }
  }

  /**
   * Clears current selection, notifying all observers
   */
  clear() {
    if (this.meshes.size) {
      logger.info({ meshes: this.meshes }, `reset multiple selection`)
      for (const mesh of this.meshes) {
        removeFromSelection(this.meshes, mesh)
      }
      if (!this.skipNotify) {
        this.onSelectionObservable.notifyObservers(this.meshes)
      }
    }
    this.skipNotify = false
  }

  /**
   * @param {Mesh} mesh - tested mesh.
   * @returns {Mesh[]} the tested mesh, or if it is contained in current selection, the entire selection.
   */
  getSelection(mesh) {
    return this.meshes.has(mesh) ? [...this.meshes] : [mesh]
  }

  /**
   * Applies selection from peer players: highlight selected meshes with the player's own color.
   * Ignores meshes that are part of current player's selection.
   * @param {string[]} meshIds - ids of selected meshes.
   * @param {string} playerId - id of the peer selecting these meshes.s.
   */
  apply(meshIds, playerId) {
    const color = this.colorByPlayerId.get(playerId)
    if (!color) {
      return
    }
    const selection = this.selectionByPeerId.get(playerId) ?? new Set()
    for (const mesh of selection) {
      removeFromSelection(selection, mesh)
    }
    const allSelections = [this.meshes, ...this.selectionByPeerId.values()]
    for (const id of meshIds) {
      addToSelection(
        allSelections,
        selection,
        null,
        this.scene.getMeshById(id),
        color
      )
    }
    if (selection.size) {
      this.selectionByPeerId.set(playerId, selection)
    }
  }

  /**
   * @param {Mesh} mesh - tested mesh.
   * @returns {boolean} whether this mesh is selected by another player or not.
   */
  isSelectedByPeer(mesh) {
    for (const selection of this.selectionByPeerId.values()) {
      if (selection.has(mesh)) {
        return true
      }
    }
    return false
  }
}

/**
 * Selection manager singleton.
 * @type {SelectionManager}
 */
export const selectionManager = new SelectionManager()

/**
 * @param {Set<Mesh>[]} allSelections - list of all players' active selection.
 * @param {Set<Mesh>} selection - active selection.
 * @param {Observable<Set<Mesh>>?} observable - to notifiy with the new selection
 * @param {?Mesh} mesh - added mesh.
 * @param {Color4} color - selection color.
 */
function addToSelection(allSelections, selection, observable, mesh, color) {
  if (
    mesh &&
    !isMeshLocked(mesh) &&
    !allSelections.find(selection => selection.has(mesh))
  ) {
    for (const added of [mesh, ...findSnapped(mesh)]) {
      selection.add(added)
      added.overlayColor = Color3.FromArray(color.asArray())
      added.overlayAlpha = 0.5
      added.edgesWidth = 3.0
      added.edgesColor = color
      added.renderOverlay = true
      added.enableEdgesRendering()
      added.onDisposeObservable.addOnce(() => {
        removeFromSelection(selection, added)
        observable?.notifyObservers(selection)
      })
    }
  }
}

/**
 * @param {?Mesh} mesh - tested mesh.
 * @returns {Mesh[]} list of snapped meshes, if any.
 */
function findSnapped(mesh) {
  if (!mesh || (mesh.metadata?.anchors?.length ?? 0) === 0) {
    return []
  }
  const scene = mesh.getScene()
  /** @type {Mesh[]} */
  const anchored = []
  for (const { snappedId } of mesh.metadata.anchors ?? []) {
    if (snappedId) {
      const mesh = scene.getMeshById(snappedId)
      if (mesh) {
        anchored.push(mesh, ...findSnapped(mesh))
      }
    }
  }
  return anchored
}

/**
 * @param {Set<Mesh>} selection - active selection.
 * @param {Mesh} mesh - added mesh.
 */
function removeFromSelection(selection, mesh) {
  selection.delete(mesh)
  mesh.renderOverlay = false
  mesh.disableEdgesRendering()
}

/**
 * @param {SelectionManager} manager - manager instance.
 */
function reorderSelection(manager) {
  // keep selection ordered from lowest to highest: it'll guarantuee gravity application
  const ordered = sortByElevation(manager.meshes)
  manager.meshes.clear()
  for (const mesh of ordered) {
    manager.meshes.add(mesh)
  }
  manager.onSelectionObservable.notifyObservers(manager.meshes)
}

/**
 * @param {SelectionManager} manager - manager instance.
 * @returns {Mesh|undefined} first selected mesh.
 */
function getFirstSelected(manager) {
  return manager.meshes.values().next().value
}
