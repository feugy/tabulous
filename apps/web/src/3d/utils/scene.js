// @ts-check
/**
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 */

import { Scene } from '@babylonjs/core/scene.js'

/**
 * Optimized version of Babylon's Scene that uses map to reference meshes by id.
 */
export class ExtendedScene extends Scene {
  /**
   * @param {Engine} engine - rendering engine.
   * @param {?} [options] - scene options.
   * @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#constructor
   */
  constructor(engine, options) {
    super(engine, options)
    /** @type {Map<string, Mesh>} */
    this.meshById = new Map()
    this.detachControl()
  }

  /**
   * @param {Mesh} mesh - added mesh.
   * @param {boolean} [recursive] - whether to add children meshes as well.
   * @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#addMesh
   */
  addMesh(mesh, recursive) {
    if (mesh?.id) {
      /* c8 ignore start */
      if (this.meshById.has(mesh.id)) {
        console.warn(`${mesh.id} reused`)
      }
      /* c8 ignore stop */
      this.meshById.set(mesh.id, mesh)
    }
    super.addMesh(mesh, recursive)
  }

  /**
   * @param {Mesh} mesh - removed mesh.
   * @param {boolean} [recursive] - whether to remove children meshes as well.
   * @returns {number} removed mesh index.
   * @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#removeMesh
   */
  removeMesh(mesh, recursive) {
    this.meshById.delete(mesh?.id)
    return super.removeMesh(mesh, recursive)
  }

  /**
   * @param {string} id - searched mesh id.
   * @returns {?Mesh} found mesh.
   * @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#getMeshByID
   */
  getMeshById(id) {
    return /** @type {?Mesh} */ (this.meshById.get(id) ?? null)
  }

  /** @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#dispose */
  dispose() {
    super.dispose()
    this.meshById.clear()
  }
}
