import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import { draggables } from '../stores'

export default function create({
  $worldWidth,
  $worldHeight,
  camera,
  clickDuration = 200,
  sensibility = 20
} = {}) {
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const ground = new Plane(new Vector3(0, 0, 1))

  let dragged
  let downTimestamp
  let width
  let height
  const widthSubscription = $worldWidth.subscribe(value => (width = value))
  const heightSubscription = $worldHeight.subscribe(value => (height = value))
  let mouse

  function translateMouse({ clientX, clientY }) {
    return {
      x: (clientX / width) * 2 - 1,
      y: (clientY / height) * -2 + 1
    }
  }

  function handleDragStart(event) {
    Object.assign(pointer, translateMouse(event))

    raycaster.setFromCamera(pointer, camera)
    // TODO takes nearest, based on distance
    dragged = raycaster
      .intersectObjects(draggables, true)
      .sort((a, b) => b.distance - a.distance)[0]?.object
    if (dragged) {
      for (; !draggables.includes(dragged); dragged = dragged.parent) {
        // find draggable ancestor TODO use map
      }
      event.stopImmediatePropagation()
      downTimestamp = Date.now()
      mouse = event
    }
  }

  function handleDrag(event) {
    if (
      dragged &&
      (Math.abs(mouse.clientX - event.clientX) > sensibility ||
        Math.abs(mouse.clientY - event.clientY) > sensibility)
    ) {
      Object.assign(pointer, translateMouse(event))
      raycaster.setFromCamera(pointer, camera)
      dragged.position.copy(raycaster.ray.intersectPlane(ground, new Vector3()))
      mouse = event
    }
  }

  function handleDragEnd() {
    if (dragged) {
      dragged.position.z = 0
      if (Date.now() - downTimestamp < clickDuration) {
        dragged.dispatchEvent({ type: 'click' })
      }
    }
    dragged = null
  }

  window.addEventListener('mousedown', handleDragStart, true)
  window.addEventListener('mousemove', handleDrag)
  window.addEventListener('mouseup', handleDragEnd)
  return {
    dispose() {
      widthSubscription.unsubscribe()
      heightSubscription.unsubscribe()
      window.removeEventListener('mousedown', handleDragStart)
      window.removeEventListener('mousemove', handleDrag)
      window.removeEventListener('mouseup', handleDragEnd)
    }
  }
}
