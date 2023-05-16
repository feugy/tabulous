import { Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector'

import { toRad } from '../../utils/math'
import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'
import { createCustom } from './custom'

/**
 * Creates a die, which could have from 4, 6, 8, 10, 12 or 20 faces.
 * @param {object} params - die parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.id - die's unique id.
 * @param {string} params.texture - die's texture url or hexadecimal string color.
 * @param {number[][]} params.faceUV? - up to TODO face UV (Vector4 components), to map texture on the die.
 * @param {number} params.x? - initial position along the X
 * @param {number} params.y? - initial position along the Y
 * @param {number} params.z? - initial position along the Z
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
  scene = mesh.getScene()
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

  behaviorStates.randomizable = {
    ...(behaviorStates.randomizable || {}),
    max: faces,
    quaternionPerFace: getQuaternions(faces)
  }
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
  return `/assets/models/die${faces}.obj`
}

const { cos, sin } = Math

// https://www.opengl-tutorial.org/fr/intermediate-tutorials/tutorial-17-quaternions/
const sinMinus90 = sin(toRad(-45))
const cosMinus90 = cos(toRad(-45))
const sin90 = sin(toRad(45))
const cos90 = cos(toRad(45))
const sin180 = sin(toRad(90))
const cos180 = cos(toRad(90))

export function getQuaternions(faces) {
  if (faces === 4) {
    // swing movement from 1 to 2,
    const swing = new Quaternion(0, sin(toRad(30)), 0, cos(toRad(30))).multiply(
      new Quaternion(sin(toRad(-55)), 0, 0, cos(toRad(-55)))
    )
    return new Map([
      [1, new Quaternion(0, 0, 0, 1)],
      [2, swing],
      [3, swing.multiply(new Quaternion(0, sin(toRad(60)), 0, cos(toRad(60))))],
      [
        4,
        swing.multiply(new Quaternion(0, sin(toRad(-60)), 0, cos(toRad(-60))))
      ]
    ])
  }
  if (faces === 6) {
    return new Map([
      [1, new Quaternion(0, 0, sin90, cos90)],
      [2, new Quaternion(0, 0, sin180, cos180)],
      [
        3,
        new Quaternion(sinMinus90, 0, 0, cosMinus90).multiply(
          new Quaternion(0, 0, sin90, cos90)
        )
      ],
      [
        4,
        new Quaternion(sin90, 0, 0, cos90).multiply(
          new Quaternion(0, 0, sinMinus90, cosMinus90)
        )
      ],
      [5, new Quaternion(0, 0, 0, 1)],
      [6, new Quaternion(0, 0, sinMinus90, cosMinus90)]
    ])
  }
  if (faces === 8) {
    // axis along which rotation bringe 1 to 3, 5 and 7, or 2 to 4, 6 and 8
    const x = 0
    const y = -cos(toRad(-55))
    const z = sin(toRad(-55))
    // swing movement from 1 to 2, 3 to 4, and so on
    const swing = new Quaternion(0, sin180, 0, cos180).multiply(
      new Quaternion(sin(toRad(35)), 0, 0, cos(toRad(35)))
    )
    return new Map([
      [8, new Quaternion(0, 0, 0, 1)],
      [7, swing],
      [6, new Quaternion(x * sin90, y * sin90, z * sin90, cos90)],
      [
        5,
        new Quaternion(
          x * sinMinus90,
          y * sinMinus90,
          z * sinMinus90,
          cosMinus90
        ).multiply(swing)
      ],
      [4, new Quaternion(x * sin180, y * sin180, z * sin180, cos180)],
      [
        3,
        new Quaternion(x * sin180, y * sin180, z * sin180, cos180).multiply(
          swing
        )
      ],
      [
        2,
        new Quaternion(
          x * sinMinus90,
          y * sinMinus90,
          z * sinMinus90,
          cosMinus90
        )
      ],
      [
        1,
        new Quaternion(x * sin90, y * sin90, z * sin90, cos90).multiply(swing)
      ]
    ])
  }
  throw new Error(`${faces} faces dice are not supported`)
}
