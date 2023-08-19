// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/utils/behaviors').SerializedMesh} SerializedMesh
 */

import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js'
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { OBJFileLoader } from '@babylonjs/loaders/OBJ'

import { controlManager } from '../managers/control'
import { customShapeManager } from '../managers/custom-shape'
import { materialManager } from '../managers/material'
import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'
import { getGroundAltitude } from '../utils/gravity'
import { applyInitialTransform, setExtras } from '../utils/mesh'

OBJFileLoader.UV_SCALING = new Vector2(-1, 1)

/**
 * Creates a custom mesh by importing .obj file.
 * It must contain the file parameter.
 * @param {Omit<SerializedMesh, 'shape'> & Required<Pick<SerializedMesh, 'file'>>} params - custom mesh parameters.
 * @param {Scene} scene - scene for the created mesh.
 * @returns {Promise<Mesh>} the created custom mesh.
 */
export async function createCustom(
  {
    id,
    file,
    texture,
    x = 0,
    y,
    z = 0,
    transform = undefined,
    ...behaviorStates
  },
  scene
) {
  const encodedData = `data:;base64,${customShapeManager.get(file)}`
  /** @type {?Mesh} */
  const mesh = await new Promise((resolve, reject) =>
    SceneLoader.ImportMesh(
      null,
      '',
      encodedData,
      scene,
      meshes => {
        const mesh = meshes?.[0]
        resolve(
          mesh?.getTotalVertices() > 0 || mesh?.getChildMeshes()?.length
            ? /** @type {Mesh} */ (mesh)
            : null
        )
      },
      null,
      (scene, message) => reject(new Error(message.replace(encodedData, file))),
      `.${file.split('.').pop()}`
    )
  )
  if (!mesh) {
    throw new Error(`${file} does not contain any mesh`)
  }
  // removes and re-add mesh to ensure it is referenced with the desired name and id.
  scene = mesh.getScene()
  scene.removeMesh(mesh, true)
  mesh.id = id
  mesh.name = 'custom'
  scene.addMesh(mesh, true)
  mesh.rotationQuaternion = null

  materialManager.configure(mesh, texture)
  applyInitialTransform(mesh, transform)

  mesh.setAbsolutePosition(new Vector3(x, y ?? getGroundAltitude(mesh), z))
  mesh.isPickable = false

  setExtras(mesh, {
    metadata: {
      serialize: () => ({
        shape: 'custom',
        file,
        texture,
        id,
        x: mesh.absolutePosition.x,
        y: mesh.absolutePosition.y,
        z: mesh.absolutePosition.z,
        transform,
        ...serializeBehaviors(mesh.behaviors)
      })
    }
  })

  registerBehaviors(mesh, behaviorStates)

  controlManager.registerControlable(mesh)
  return mesh
}
