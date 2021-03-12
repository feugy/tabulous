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
  const down = new Vector3(0, -1, 0)
  const up = new Vector3(0, 1, 0)
  const scene = mesh.getScene()
  const over = new Set()
  function predicate(other) {
    return other.isPickable && other !== mesh
  }
  for (const vertex of [...boundingBox.vectorsWorld, mesh.position]) {
    // new RayHelper(new Ray(vertex, direction, 10)).show(scene)
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
