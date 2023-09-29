// @ts-check
import { Scene } from '@babylonjs/core/scene.js'

/**
 * Optimized version of Babylon's Scene that uses map to reference meshes by id.
 */
export class ExtendedScene extends Scene {
  /**
   * @param {import('@babylonjs/core').Engine} engine - rendering engine.
   * @param {?} [options] - scene options.
   * @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#constructor
   */
  constructor(engine, options) {
    super(engine, options)
    /** @type {Map<string, import('@babylonjs/core').Mesh>} */
    this.meshById = new Map()
    this.detachControl()
  }

  /**
   * @param {import('@babylonjs/core').Mesh} mesh - added mesh.
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
   * @param {import('@babylonjs/core').Mesh} mesh - removed mesh.
   * @param {boolean} [recursive] - whether to remove children meshes as well.
   * @returns removed mesh index.
   * @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#removeMesh
   */
  removeMesh(mesh, recursive) {
    this.meshById.delete(mesh?.id)
    return super.removeMesh(mesh, recursive)
  }

  /**
   * @param {string} id - searched mesh id.
   * @returns found mesh.
   * @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#getMeshByID
   */
  getMeshById(id) {
    return /** @type {?import('@babylonjs/core').Mesh} */ (
      this.meshById.get(id) ?? null
    )
  }

  /** @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#dispose */
  dispose() {
    super.dispose()
    this.meshById.clear()
  }
}
