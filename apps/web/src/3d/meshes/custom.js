import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import {
  controlManager,
  customShapeManager,
  materialManager
} from '../managers'
import { getDimensions, registerBehaviors, serializeBehaviors } from '../utils'
// mandatory side effect
import '@babylonjs/core/Loading/Plugins'

/**
 * Creates a custom mesh by importing .babylon format.
 * @param {object} params - mesh parameters, including:
 * @param {string} params.id - mesh's unique id.
 * @param {string} params.file - file containing the mesh's shape.
 * @param {string} params.texture - card's texture url or hexadecimal string color.
 * @param {number[][]} params.faceUV? - as manuy face UV (Vector4 components), as needed to map texture on the shape.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {import('@babylonjs/core').Scene} scene? - scene to host this card (default to last scene).
 * @returns {import('@babylonjs/core').Mesh} the created card mesh.
 * @throws {Error} when the required file does not exist or contain invalid mesh data.
 */
export function createCustom(
  { id, file, texture, x = 0, y, z = 0, ...behaviorStates },
  scene
) {
  let mesh
  SceneLoader.ImportMesh(
    null,
    '',
    `data:;base64,${customShapeManager.get(file)}`,
    scene,
    meshes => {
      // note: because we're using data url, this function is synchronously called by Babylon.
      // this allows createCustom() to be synchronous, which simplifies scene loading and updating
      mesh = meshes?.[0]
    },
    null,
    (scene, message, error) => {
      throw error ?? new Error(message)
    },
    '.babylon'
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

  const { height } = getDimensions(mesh)
  mesh.setAbsolutePosition(new Vector3(x, y ?? height * 0.5, z))
  mesh.isPickable = false

  mesh.metadata = {
    serialize: () => ({
      shape: 'custom',
      file,
      texture,
      id,
      x: mesh.position.x,
      y: mesh.position.y,
      z: mesh.position.z,
      ...serializeBehaviors(mesh.behaviors)
    })
  }

  registerBehaviors(mesh, behaviorStates)

  controlManager.registerControlable(mesh)
  return mesh
}
