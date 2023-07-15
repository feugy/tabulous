/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 */

/**
 * Indicates whether a given container completely contain the tested mesh, using their bounding boxes.
 * @param {Mesh} container - container that may contain the mesh.
 * @param {Mesh} mesh - tested mesh.
 * @returns {boolean} true if container contains mesh, false otherwise.
 */
export function isContaining(container, mesh) {
  container.computeWorldMatrix(true)
  const { maximumWorld: containerMax, minimumWorld: containerMin } =
    container.getBoundingInfo().boundingBox
  mesh.computeWorldMatrix(true)
  const { maximumWorld: meshMax, minimumWorld: meshMin } =
    mesh.getBoundingInfo().boundingBox
  return (
    containerMin.x <= meshMin.x &&
    meshMax.x <= containerMax.x &&
    containerMin.y <= meshMin.y &&
    meshMax.y <= containerMax.y &&
    containerMin.z <= meshMin.z &&
    meshMax.z <= containerMax.z
  )
}

/**
 * @typedef {object} Dimensions mesh's bounding box
 * @property {number} height - the mesh's height.
 * @property {number} width - the mesh's width.
 */

/**
 * Returns a given mesh's dimension, that is its extent on Y and X axes.
 * **Requires a fresh world matrix**.
 * @param {Mesh} mesh - sized mesh.
 * @returns {Dimensions} mesh's dimensions.
 */
export function getDimensions(mesh) {
  mesh.computeWorldMatrix(true)
  const { x, y, z } = mesh.getBoundingInfo().boundingBox.extendSizeWorld
  return { width: x * 2, height: y * 2, depth: z * 2 }
}

/**
 * @typedef {object} InitialTransform mesh's bounding box
 * @property {number} yaw? - yaw (rotation on x) applied.
 * @property {number} pitch? - pitch (rotation on y) applied.
 * @property {number} roll? - yaw (rotation on z) applied.
 * @property {number} scaleX? - scale on x applied.
 * @property {number} scaleY? - scale on y applied.
 * @property {number} scaleZ? - scale on z applied.
 */

/**
 * Applies an initial transformation to the built mesh, baking it into the vertices.
 * @param {Mesh} mesh - transformed mesh.
 * @param {InitialTransform} transform? - initial transform applied (may be undefined).
 */
export function applyInitialTransform(mesh, transform) {
  if (transform) {
    const { yaw, pitch, roll, scaleX, scaleY, scaleZ } = transform
    mesh.rotation.x = yaw ?? 0
    mesh.rotation.y = pitch ?? 0
    mesh.rotation.z = roll ?? 0
    mesh.scaling.x = scaleX ?? 1
    mesh.scaling.y = scaleY ?? 1
    mesh.scaling.z = scaleZ ?? 1
    mesh.bakeCurrentTransformIntoVertices()
  }
}
