import { Matrix } from '@babylonjs/core/Maths/math.vector'

import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'
import { createCustom } from './custom'

/**
 * Creates a die, which could have from 4, 6, 8, 10, 12 or 20 faces.
 * @param {object} params - die parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.id - die's unique id.
 * @param {string} params.texture - die's texture url or hexadecimal string color.
 * @param {number[][]} params.faceUV? - up to TODO face UV (Vector4 components), to map texture on the die.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {number} params.diameter? - token's diameter (all axis).
 * @param {number} params.faces? - number of faces (6 by default)
 * @param {import('@babylonjs/core').Scene} scene? - scene to host this die (default to last scene).
 * @returns {Promise<import('@babylonjs/core').Mesh>} the created custom mesh.
 */
export async function createDie(
  {
    id,
    x = 0,
    y,
    z = 0,
    diameter = 1,
    faces = 6,
    texture,
    ...behaviorStates
  } = {},
  scene
) {
  const mesh = await createCustom(
    {
      id,
      texture,
      x,
      y,
      z,
      file: getDieModelFile(faces)
    },
    scene
  )

  if (diameter && diameter !== 1) {
    mesh.bakeTransformIntoVertices(Matrix.Scaling(diameter, diameter, diameter))
  }
  // removes and re-add mesh to ensure it is referenced with the desired name.
  scene.removeMesh(mesh, true)
  mesh.name = 'die'
  scene.addMesh(mesh, true)

  mesh.metadata.serialize = () => ({
    shape: mesh.name,
    id,
    x: mesh.absolutePosition.x,
    y: mesh.absolutePosition.y,
    z: mesh.absolutePosition.z,
    texture,
    diameter,
    faces,
    ...serializeBehaviors(mesh.behaviors)
  })

  if (!behaviorStates.randomizable) {
    behaviorStates.randomizable = {}
  }
  behaviorStates.randomizable.max = faces
  behaviorStates.randomizable.rotationPerFace = getRotations(faces)
  registerBehaviors(mesh, behaviorStates)

  return mesh
}

/**
 * Computes the model file url for a given die.
 * @param {number} faces - number of faces for this die (4, 6, 8, 10, 12 or 20).
 * @returns {string} url of the model file.
 * @throws {Error} if the desired number of faces is not supported.
 */
export function getDieModelFile(faces) {
  if (![4, 6, 8, 10, 12, 20].includes(faces)) {
    throw new Error(`${faces} faces dice are not supported`)
  }
  return `/models/die${faces}.obj`
}

export function getRotations(faces) {
  if (faces === 6) {
    return new Map([
      [1, [0, 0, 0]],
      [2, [0, 0, -0.5 * Math.PI]],
      [3, [0.5 * Math.PI, 0, 0]],
      [4, [-0.5 * Math.PI, 0, 0]],
      [5, [0, 0, 0.5 * Math.PI]],
      [6, [0, 0, Math.PI]]
    ])
  }
  if (faces === 8) {
    return new Map([
      [1, [0, 0, 0]],
      [2, [toRad(70), toRad(180), 0]],
      [3, [toRad(-25), toRad(-40), toRad(-70)]],
      [4, [toRad(25), toRad(140), toRad(-110)]],
      [5, [toRad(-70), 0, toRad(180)]],
      [6, [toRad(0), toRad(180), toRad(180)]],
      [7, [toRad(-25), toRad(40), toRad(70)]],
      [8, [toRad(25), toRad(-140), toRad(110)]]
    ])
  }
  /* 4 faces 
  new Map([
    [1, [0, 0, 0]],
    [2, [(250 * Math.PI), 0, 0]],
    [3, [(28 * Math.PI), 0, (247 * Math.PI)]],
    [4, [(28 * Math.PI), 0, (112 * Math.PI)]]
  ])
  */
  throw new Error(`${faces} faces dice are not supported`)
}

function toRad(degree) {
  return (degree * Math.PI) / 180
}
