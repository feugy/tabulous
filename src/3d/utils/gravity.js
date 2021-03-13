import Babylon from 'babylonjs'

const { Ray, Vector3 } = Babylon

const rayLength = 30

export function applyGravity(mesh) {
  console.log(`gravity for ${mesh.id} y: ${mesh.absolutePosition.y}`)
  const { boundingBox } = mesh.getBoundingInfo()
  const down = Vector3.Down()
  const scene = mesh.getScene()
  const over = new Set()
  const predicate = other => other.isPickable && other !== mesh
  for (const vertex of [...boundingBox.vectorsWorld, mesh.absolutePosition]) {
    const hit = scene.pickWithRay(new Ray(vertex, down, rayLength), predicate)
    if (hit.pickedMesh) {
      over.add(hit.pickedMesh)
    }
  }
  let y = 0
  if (over.size) {
    const ordered = [...over.values()].sort(
      (a, b) => b.absolutePosition.y - a.absolutePosition.y
    )
    y = ordered[0].getBoundingInfo().boundingBox.maximumWorld.y + 0.02
    console.log(
      `${mesh.id} (${mesh.absolutePosition.y}) is above ${ordered.map(
        ({ id }) => id
      )}`
    )
  }
  console.log(`${mesh.id} y = ${y}`)
  const { x, z } = mesh.absolutePosition
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.computeWorldMatrix(true)
  return mesh.absolutePosition
}

const targetScale = 0.3

export function isAbove(mesh, target) {
  const { boundingBox } = mesh.getBoundingInfo()
  const down = Vector3.Down()
  const originalScale = target.scaling.clone()
  target.scaling.addInPlace(new Vector3(targetScale, targetScale, targetScale))
  target.computeWorldMatrix(true)
  let hit = 0
  for (const vertex of boundingBox.vectorsWorld) {
    if (new Ray(vertex, down, rayLength).intersectsMesh(target).hit) {
      hit++
    } else {
      break
    }
  }
  target.scaling.copyFrom(originalScale)
  return hit === boundingBox.vectorsWorld.length
}
