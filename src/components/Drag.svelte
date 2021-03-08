<script>
  import { getContext } from 'svelte'
  import { Plane, Raycaster, Vector2, Vector3 } from 'three'
  import { CAMERA } from './Scene.svelte'
  import { draggables } from '../stores'

  export let width
  export let height

  const camera = getContext(CAMERA)

  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const ground = new Plane(new Vector3(0, 0, 1))

  const clickDuration = 200

  let dragged
  let downTimestamp

  function translateMouse({ clientX, clientY }) {
    return {
      x: (clientX / width) * 2 - 1,
      y: (clientY / height) * -2 + 1
    }
  }

  function handleDragStart(event) {
    Object.assign(pointer, translateMouse(event))

    raycaster.setFromCamera(pointer, camera)
    dragged = raycaster.intersectObjects(draggables, true)[0]?.object
    if (dragged) {
      event.stopImmediatePropagation()
      downTimestamp = Date.now()
    }
  }

  function handleDrag(event) {
    if (dragged) {
      Object.assign(pointer, translateMouse(event))
      raycaster.setFromCamera(pointer, camera)
      dragged.position.copy(raycaster.ray.intersectPlane(ground, new Vector3()))
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
</script>

<svelte:window
  on:mousedown={handleDragStart}
  on:mousemove={handleDrag}
  on:mouseup={handleDragEnd}
/>
