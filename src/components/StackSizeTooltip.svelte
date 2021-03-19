<script>
  import { onMount } from 'svelte'
  import { engine } from '../stores'

  let left = 0
  let top = 0
  let object
  let stackSize

  onMount(() =>
    engine.subscribe(engine => {
      if (!engine) {
        return
      }
      engine.onPointerOver.subscribe(
        ({ mesh, event: { clientX, clientY } }) => {
          object = mesh
          stackSize = null
          if (object.metadata?.stack?.length > 1) {
            stackSize = object.metadata.stack.length
            left = clientX
            top = clientY
          }
        }
      )
      engine.onDragEnd.subscribe(({ mesh, event: { clientX, clientY } }) =>
        // TODO should listen to drop instead
        setTimeout(() => {
          if (mesh === object && object.metadata?.stack?.length > 1) {
            stackSize = object.metadata.stack.length
            left = clientX
            top = clientY
          }
        }, 0)
      )
      engine.onPointerOut.subscribe(() => (object = null))
    })
  )
</script>

<style>
  div {
    display: inline-block;
    visibility: hidden;
    position: absolute;
    color: white;
    font-weight: 600;
    font-size: 1.2rem;
    text-shadow: 0 0 2px black;
    margin-top: -1rem;
    margin-left: 1rem;
    height: auto;
    width: auto;
  }
</style>

<div
  style={`visibility: ${
    object && stackSize ? 'visible' : 'hidden'
  }; left: ${left}px; top: ${top}px`}
>
  {stackSize}
</div>
