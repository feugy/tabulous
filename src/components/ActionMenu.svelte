<script>
  import { onMount } from 'svelte'
  import { engine } from '../stores'
  import { getMeshCoordinates, shuffle } from '../utils'

  let left = 0
  let top = 0
  let actions = []
  let isDragging = false
  let object
  let timeout

  const delay = 500

  onMount(() =>
    engine.subscribe(engine => {
      if (!engine) {
        return
      }
      engine.onPointerOver.subscribe(({ mesh }) => {
        clearTimeout(timeout)
        if (!object && !isDragging) {
          timeout = setTimeout(() => {
            object = mesh
            const { x, y } = getMeshCoordinates(object)
            left = x
            top = y
            actions = []
            if (object.metadata.flip) {
              actions.push({
                name: 'Retourner',
                action: () => object.metadata.flip()
              })
            }
            if (object.metadata.rotate) {
              actions.push({
                name: 'Pivoter',
                action: () => object.metadata.rotate()
              })
            }
            if (object.metadata.stack?.length > 1) {
              actions.push({
                name: 'Mélanger',
                action: () => {
                  const ids = object.metadata.stack.map(({ id }) => id)
                  object.metadata.shuffle(shuffle(ids))
                }
              })
            }
          }, delay)
        }
      })
      engine.onDragStart.subscribe(({ mesh }) => {
        clearTimeout(timeout)
        isDragging = true
        if (mesh.id === object?.id) {
          object = null
        }
      })
      engine.onDragEnd.subscribe(() => {
        clearTimeout(timeout)
        isDragging = false
      })
      engine.onPointerOut.subscribe(() => {
        clearTimeout(timeout)
        isDragging = false
        object = null
      })
    })
  )
</script>

<style>
  ul {
    position: absolute;
    height: auto;
    width: auto;
    display: inline-flex;
    flex-direction: column;
    visibility: hidden;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  button {
    min-width: 100%;
  }
</style>

<ul
  on:pointerdown|stopPropagation
  style={`visibility: ${
    object ? 'visible' : 'hidden'
  }; left: ${left}px; top: ${top}px`}
>
  {#each actions as { name, action }}
    <li>
      <button on:click={action}>{name}</button>
    </li>
  {/each}
</ul>
