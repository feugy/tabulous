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
