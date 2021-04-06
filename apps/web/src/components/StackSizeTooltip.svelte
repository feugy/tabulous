<script>
  import { onMount } from 'svelte'
  import { dragEnd, pointerOut, pointerOver } from '../stores'

  let left = 0
  let top = 0
  let object
  let stackSize

  onMount(() => {
    const subs = [
      pointerOver.subscribe(handlePointerOver),
      pointerOut.subscribe(handlePointerOut),
      dragEnd.subscribe(handleDragEnd)
    ]
    return () => subs.map(sub => sub.unsubscribe())
  })

  function handlePointerOver({ mesh, event: { clientX, clientY } }) {
    object = mesh
    stackSize = null
    if (object.metadata?.stack?.length > 1) {
      stackSize = object.metadata.stack.length
      left = clientX
      top = clientY
    }
  }

  function handleDragEnd({ mesh, event: { clientX, clientY } }) {
    // TODO should listen to drop instead
    setTimeout(() => {
      if (mesh === object && object.metadata?.stack?.length > 1) {
        stackSize = object.metadata.stack.length
        left = clientX
        top = clientY
      }
    }, 0)
  }

  function handlePointerOut() {
    object = null
  }
</script>

<style type="postcss">
  div {
    @apply absolute invisible inline-block font-semibold text-lg text-white h-auto w-auto -mt-8 -ml-8;
    text-shadow: 0 0 2px black;
  }
</style>

<div
  style={`visibility: ${
    object && stackSize ? 'visible' : 'hidden'
  }; left: ${left}px; top: ${top}px`}
>
  {stackSize}
</div>
