import {
  AnimateBehavior,
  FlipBehavior,
  RotateBehavior,
  StackBehavior,
  TargetBehavior
} from '../behaviors'
import { applyGravity } from './gravity'

export async function animateMove(
  mesh,
  absolutePosition,
  duration,
  withGravity = false
) {
  const movable = getAnimatableBehavior(mesh)
  if (mesh.getScene().isLoading || !movable || !duration) {
    mesh.setAbsolutePosition(absolutePosition)
    if (withGravity) {
      applyGravity(mesh)
    }
  } else {
    return movable.moveTo(absolutePosition, duration, withGravity)
  }
}

export function getAnimatableBehavior(mesh) {
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
