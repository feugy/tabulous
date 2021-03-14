import {
  FlipBehavior,
  MoveBehavior,
  StackBehavior,
  TargetBehavior
} from '../behaviors'

export function animateMove(
  mesh,
  absolutePosition,
  duration,
  onEnd = () => {}
) {
  const movable = getMoveableBehavior(mesh)
  if (!movable) {
    mesh.setAbsolutePosition(absolutePosition)
    onEnd(mesh)
  } else {
    movable.moveTo(absolutePosition, duration)
    movable.onMoveEndObservable.addOnce(() => onEnd(mesh))
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
