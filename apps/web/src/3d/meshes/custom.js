// @ts-check
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js'
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { OBJFileLoader } from '@babylonjs/loaders/OBJ'

import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'
import { getGroundAltitude } from '../utils/gravity'
import { applyInitialTransform, setExtras } from '../utils/mesh'

OBJFileLoader.UV_SCALING = new Vector2(-1, 1)

/**
 * Creates a custom mesh by importing .obj file.
 * It must contain the file parameter.
 * @param {Omit<import('@src/3d/utils/behaviors').SerializedMesh, 'shape'> & Required<Pick<import('@src/3d/utils/behaviors').SerializedMesh, 'file'>>} params - custom mesh parameters.
 * @param {import('@src/3d/managers').Managers} managers - current managers.
 * @param {import('@babylonjs/core').Scene} scene - scene for the created mesh.
 * @returns the created custom mesh.
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
  managers,
  scene
) {
  const encodedData = `data:;base64,${managers.customShape.get(file)}`
  /** @type {?import('@babylonjs/core').Mesh} */
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
            ? /** @type {import('@babylonjs/core').Mesh} */ (mesh)
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

  managers.material.configure(mesh, texture)
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

  registerBehaviors(mesh, behaviorStates, managers)

  managers.control.registerControlable(mesh)
  return mesh
}
