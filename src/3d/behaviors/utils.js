import Babylon from 'babylonjs'
const { Ray, Vector3 } = Babylon

export function animateMove(mesh, position, duration, onEnd = () => {}) {
  const movable =
    mesh.getBehaviorByName('move') || mesh.getBehaviorByName('flip')
  if (!movable) {
    mesh.position.copy(position)
    onEnd()
  } else {
    movable.moveTo(position, duration)
    movable.onMoveStopObservable.addOnce(onEnd)
  }
}

const rayLength = 30

export function applyGravity(mesh) {
  const { boundingBox } = mesh.getBoundingInfo()
  const down = Vector3.Down()
  const up = Vector3.Up()
  const scene = mesh.getScene()
  const over = new Set()
  function predicate(other) {
    return other.isPickable && other !== mesh
  }
  for (const vertex of [...boundingBox.vectorsWorld, mesh.position]) {
    let hit = scene.pickWithRay(new Ray(vertex, down, rayLength), predicate)
    if (hit.pickedMesh) {
      over.add(hit.pickedMesh)
    }
    hit = scene.pickWithRay(new Ray(vertex, up, rayLength), predicate)
    if (hit.pickedMesh) {
      over.add(hit.pickedMesh)
    }
  }
  if (over.size) {
    const ordered = [...over.values()].sort(
      (a, b) => b.position.y - a.position.y
    )
    mesh.position.y =
      ordered[0].getBoundingInfo().boundingBox.maximumWorld.y + 0.02
  }
  return mesh.position
}

export function isAbove(mesh, target) {
  const { boundingBox } = mesh.getBoundingInfo()
  const down = Vector3.Down()
  const originalScale = target.scaling.clone()
  target.scaling.addInPlace(new Vector3(0.2, 0.2, 0.2))
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
