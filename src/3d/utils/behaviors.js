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
  return mesh?.getBehaviorByName('move') || mesh?.getBehaviorByName('flip')
}

export function getTargetableBehavior(mesh) {
  return mesh?.getBehaviorByName('stack') || mesh?.getBehaviorByName('target')
}
