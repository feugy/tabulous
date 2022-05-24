/**
 * Indicates whether a given container completely contain the tested mesh, using their bounding boxes.
 * @param {import('@babylonjs/core').Mesh} container - container that may contain the mesh.
 * @param {import('@babylonjs/core').Mesh} mesh - tested mesh.
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
 * Returns a given mesh's dimension, that is its extend on Y and X axes.
 * **Requires a fresh world matrix**.
 * @param {import('@babylonjs/core').Mesh} mesh - sized mesh.
 * @returns {Dimensions} mesh's dimensions.
 */
export function getDimensions(mesh) {
  mesh.computeWorldMatrix(true)
  const { x, y, z } = mesh.getBoundingInfo().boundingBox.extendSizeWorld
  return { width: x * 2, height: y * 2, depth: z * 2 }
}
