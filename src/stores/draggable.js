export const draggables = []

export function addDraggable(object) {
  if (!draggables.includes(object)) {
    draggables.push(object)
  }
}

export function removeDraggable(object) {
  const idx = draggables.indexOf(object)
  if (idx >= 0) {
    draggables.splice(idx, 1)
  }
}
