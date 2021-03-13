import Babylon from 'babylonjs'
const { Ray, Vector3 } = Babylon

export function animateMove(
  mesh,
  absolutePosition,
  duration,
  onEnd = () => {}
) {
  const movable = getMoveableBehavior(mesh)
  if (!movable) {
    mesh.setAbsolutePosition(absolutePosition)
    onEnd()
  } else {
    movable.moveTo(absolutePosition, duration)
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
  for (const vertex of [...boundingBox.vectorsWorld, mesh.absolutePosition]) {
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
      (a, b) => b.absolutePosition.y - a.absolutePosition.y
    )
    console.log(`${mesh.id} > ${ordered[0].id}`)
    const { x, z } = mesh.absolutePosition
    mesh.setAbsolutePosition(
      new Vector3(
        x,
        ordered[0].getBoundingInfo().boundingBox.maximumWorld.y + 0.02,
        z
      )
    )
  }
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

export function getMoveableBehavior(mesh) {
  return mesh?.getBehaviorByName('move') || mesh?.getBehaviorByName('flip')
}

export function getTargetableBehavior(mesh) {
  return mesh?.getBehaviorByName('stack') || mesh?.getBehaviorByName('target')
}
