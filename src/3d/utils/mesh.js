export function isContaining(container, mesh) {
  if (!container.intersectsMesh(mesh)) {
    return false
  }
  const {
    maximumWorld: containerMax,
    minimumWorld: containerMin
  } = container.getBoundingInfo().boundingBox
  const {
    maximumWorld: meshMax,
    minimumWorld: meshMin
  } = mesh.getBoundingInfo().boundingBox
  return (
    meshMax.x <= containerMax.x &&
    meshMax.z <= containerMax.z &&
    meshMin.x >= containerMin.x &&
    meshMin.z >= containerMin.z
  )
}
