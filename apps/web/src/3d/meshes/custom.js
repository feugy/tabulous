import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js'
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { OBJFileLoader } from '@babylonjs/loaders/OBJ'

import { controlManager } from '../managers/control'
import { customShapeManager } from '../managers/custom-shape'
import { materialManager } from '../managers/material'
import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'
import { getGroundAltitude } from '../utils/gravity'
import { applyInitialTransform } from '../utils/mesh'

OBJFileLoader.UV_SCALING = new Vector2(-1, 1)

/**
 * Creates a custom mesh by importing .babylon format.
 * @param {object} params - mesh parameters, including:
 * @param {string} params.id - mesh's unique id.
 * @param {string} params.file - file containing the mesh's shape.
 * @param {string} params.texture - mesh's texture url or hexadecimal string color.
 * @param {number[][]} params.faceUV? - as manuy face UV (Vector4 components), as needed to map texture on the shape.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {import('../utils').InitialTransform} params.transform? - initial transformation baked into the mesh's vertice.
 * @param {import('@babylonjs/core').Scene} scene? - scene to host this mesh (default to last scene).
 * @returns {Promise<import('@babylonjs/core').Mesh>} the created custom mesh.
 * @throws {Error} when the required file does not exist or contain invalid mesh data.
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
            ? mesh
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
  mesh.isHittable = true

  mesh.metadata = {
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

  registerBehaviors(mesh, behaviorStates)

  controlManager.registerControlable(mesh)
  return mesh
}
