// @ts-check
import { Observable } from '@babylonjs/core/Misc/observable'

/**
 * Configures Tabulous extra mesh attributes on a Babylon.js mesh.
 * @template {import('@babylonjs/core').AbstractMesh} M
 * @param {M} mesh - initialized mesh.
 * @param {Partial<Pick<M, 'isCylindric'|'isHittable'|'isPhantom'|'isDropZone'|'animationInProgress'|'metadata'>>} [extras] - extra attribute values.
 * @return {M} the modified mesh.
 */
export function setExtras(mesh, extras = {}) {
  return Object.assign(mesh, {
    isCylindric: false,
    isHittable: true,
    isPhantom: false,
    isDropZone: false,
    animationInProgress: false,
    onAnimationEnd: new Observable(),
    detachedChildren: [],
    ...extras
  })
}

/**
 * @template {import('@babylonjs/core').AbstractMesh} M
 * @param {?M} [mesh] - tested mesh.
 * @returns {boolean} whether a mesh or any of ist (indirect) children are animated.
 */
export function isAnimationInProgress(mesh) {
  return !mesh
    ? false
    : mesh.animationInProgress ||
        [
          .../** @type {M[]} */ (mesh.getChildMeshes(true)),
          ...mesh.detachedChildren
        ].some(isAnimationInProgress)
}

/**
 * Indicates whether a given container completely contain the tested mesh, using their bounding boxes.
 * @template {import('@babylonjs/core').AbstractMesh} M
 * @param {M} container - container that may contain the mesh.
 * @param {M} mesh - tested mesh.
 * @returns true if container contains mesh, false otherwise.
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
 * Returns a given mesh's dimension, that is its extent on Y and X axes.
 * **Requires a fresh world matrix**.
 * @template {import('@babylonjs/core').AbstractMesh} T
 * @param {T} mesh - sized mesh.
 * @returns mesh's dimensions.
 */
export function getDimensions(mesh) {
  mesh.computeWorldMatrix(true)
  const { x, y, z } = mesh.getBoundingInfo().boundingBox.extendSizeWorld
  return { width: x * 2, height: y * 2, depth: z * 2 }
}

/**
 * Applies an initial transformation to the built mesh, baking it into the vertices.
 * @param {import('@babylonjs/core').Mesh} mesh - transformed mesh.
 * @param {import('@tabulous/types').InitialTransform} [transform] - initial transform applied (may be undefined).
 */
export function applyInitialTransform(mesh, transform) {
  if (transform) {
    const { yaw, pitch, roll, scaleX, scaleY, scaleZ } = transform
    mesh.rotation.x = pitch ?? 0
    mesh.rotation.y = yaw ?? 0
    mesh.rotation.z = roll ?? 0
    mesh.scaling.x = scaleX ?? 1
    mesh.scaling.y = scaleY ?? 1
    mesh.scaling.z = scaleZ ?? 1
    mesh.bakeCurrentTransformIntoVertices()
  }
}
