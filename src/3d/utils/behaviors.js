import {
  FlipBehavior,
  MoveBehavior,
  StackBehavior,
  TargetBehavior
} from '../behaviors'

export function animateMove(mesh, absolutePosition, duration, onEnd) {
  const movable = getMoveableBehavior(mesh)
  if (mesh.getScene().isLoading || !movable || !duration) {
    mesh.setAbsolutePosition(absolutePosition)
    if (onEnd) {
      onEnd(mesh)
    }
  } else {
    movable.moveTo(absolutePosition, duration, false)
    if (onEnd) {
      movable.onMoveEndObservable.addOnce(() => onEnd(mesh))
    }
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
