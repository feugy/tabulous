import {
  FlipBehavior,
  MoveBehavior,
  StackBehavior,
  TargetBehavior
} from '../behaviors'

export async function animateMove(mesh, absolutePosition, duration) {
  const movable = getMoveableBehavior(mesh)
  if (mesh.getScene().isLoading || !movable || !duration) {
    mesh.setAbsolutePosition(absolutePosition)
  } else {
    return movable.moveTo(absolutePosition, duration, false)
  }
}

export function getMoveableBehavior(mesh) {
  return (
    mesh?.getBehaviorByName(MoveBehavior.NAME) ||
    mesh?.getBehaviorByName(FlipBehavior.NAME)
  )
}

export function getTargetableBehavior(mesh) {
  return (
    mesh?.getBehaviorByName(StackBehavior.NAME) ||
    mesh?.getBehaviorByName(TargetBehavior.NAME)
  )
}
