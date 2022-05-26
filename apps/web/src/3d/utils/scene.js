import { Scene } from '@babylonjs/core/scene'

/**
 * Optimized version of Babylon's Scene that uses map to reference meshes by id.
 */
export class ExtendedScene extends Scene {
  /** @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#constructor */
  constructor(...args) {
    super(...args)
    this.meshById = new Map()
    this.detachControl()
  }

  /** @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#addmesh */
  addMesh(mesh, ...args) {
    if (mesh?.id) {
      this.meshById.set(mesh.id, mesh)
    }
    super.addMesh(mesh, ...args)
  }

  /** @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#removemesh */
  removeMesh(mesh, ...args) {
    this.meshById.delete(mesh?.id)
    super.removeMesh(mesh, ...args)
  }

  /** @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#getmeshbyid-1 */
  getMeshById(id) {
    return this.meshById.get(id) ?? null
  }

  /** @see https://doc.babylonjs.com/typedoc/classes/babylon.scene#dispose */
  dispose() {
    super.dispose()
    this.meshById.clear()
  }
}
