import { PerspectiveCamera } from 'three'

export default function create({
  initialZoom = 7,
  maxZoom = 20,
  minZoom = 2,
  sensibility = 10
} = {}) {
  const instance = new PerspectiveCamera(75, 1, 1, 10000)
  instance.position.set(0, 0, initialZoom)

  let mouse
  let movement = { axis: 'x', positive: true, active: false }

  // TODO support tap
  function handleMouseDown({ clientX, clientY }) {
    mouse = { x: clientX, y: clientY }
  }

  function handleMouseMove({ clientX, clientY }) {
    if (mouse) {
      if (
        Math.abs(mouse.x - clientX) > sensibility ||
        Math.abs(mouse.y - clientY) > sensibility
      ) {
        // TODO apply zoom to movement
        if (mouse.x !== clientX) {
          instance.position.x += (mouse.x - clientX) / 100
        }
        if (mouse.y !== clientY) {
          instance.position.y += (clientY - mouse.y) / 100
        }
      }
      mouse = { x: clientX, y: clientY }
    }
  }

  function handleMouseUp() {
    mouse = null
  }

  function handleWheel({ deltaY }) {
    instance.position.z = Math.min(
      Math.max(instance.position.z + deltaY / 5, minZoom),
      maxZoom
    )
  }

  window.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('wheel', handleWheel)
  return {
    instance,
    tick() {
      if (movement.active) {
        instance.position[movement.axis] += 0.02 * (movement.positive ? 1 : -1)
      }
    },
    dispose() {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('wheel', handleWheel)
    },
    startMove(axis, positive = true) {
      movement = { axis, positive, active: true }
    },
    stopMove() {
      movement.active = false
    },
    reset() {
      instance.position.set(0, 0, initialZoom)
    }
  }
}
