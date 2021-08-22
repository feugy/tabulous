import {
  AnimateBehavior,
  FlipBehavior,
  RotateBehavior,
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
    mesh?.getBehaviorByName(AnimateBehavior.NAME) ||
    mesh?.getBehaviorByName(FlipBehavior.NAME) ||
    mesh?.getBehaviorByName(RotateBehavior.NAME)
  )
}

export function getTargetableBehavior(mesh) {
  return (
    mesh?.getBehaviorByName(StackBehavior.NAME) ||
    mesh?.getBehaviorByName(TargetBehavior.NAME)
  )
}
