/**
 * @typedef {object} ImageDefs detailed images definitions for a given mesh:
 * @property {string} front - image for the mesh front face.
 * @property {string} back? - image for the mesh front back.
 */

/**
 * Indicates whether a given container completely contain the tested mesh, using their bounding boxes.
 * @param {import('@babylonjs/core').Mesh} container - container that may contain the mesh.
 * @param {import('@babylonjs/core').Mesh} mesh - tested mesh.
 * @returns {boolean} true if container contains mesh, false otherwise.
 */
export function isContaining(container, mesh) {
  const {
    maximumWorld: containerMax,
    minimumWorld: containerMin
  } = container.getBoundingInfo().boundingBox
  const {
    maximumWorld: meshMax,
    minimumWorld: meshMin
  } = mesh.getBoundingInfo().boundingBox
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
 * Returns a given mesh's height, that is its extend on Y axis.
 * @param {import('@babylonjs/core').Mesh} mesh - for which we want its height.
 * @returns {number} the mesh's height, in 3D scale.
 */
export function getHeight(mesh) {
  return mesh.getBoundingInfo().boundingBox.extendSizeWorld.y
}
