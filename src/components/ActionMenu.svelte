<script>
  import { onMount } from 'svelte'
  import { FlipBehavior, RotateBehavior } from '../3d/behaviors'
  import { dragManager, multiSelectionManager } from '../3d/managers'
  import { groundToScreen } from '../3d/utils'

  let left = 0
  let top = 0
  let actions = []
  let isDragging = false
  let object
  let timeout

  const delay = 500

  onMount(() => {
    const onOverObserver = multiSelectionManager.onOverObservable.add(
      ({ mesh }) => {
        clearTimeout(timeout)
        if (!object && !isDragging) {
          timeout = setTimeout(() => {
            object = mesh
            const { x, y } = groundToScreen(
              mesh.absolutePosition,
              mesh.getScene()
            )
            left = x
            top = y
            actions = []
            const flipBehavior = mesh.getBehaviorByName(FlipBehavior.NAME)
            if (flipBehavior) {
              actions.push({
                name: 'Retourner',
                action: () => flipBehavior.flip()
              })
            }
            const rotateBehavior = mesh.getBehaviorByName(RotateBehavior.NAME)
            if (rotateBehavior) {
              actions.push({
                name: 'Tourner',
                action: () => rotateBehavior.rotate()
              })
            }
          }, delay)
        }
      }
    )
    const onDragStartObserver = dragManager.onDragStartObservable.add(
      ({ mesh }) => {
        clearTimeout(timeout)
        isDragging = true
        if (mesh.id === object?.id) {
          object = null
        }
      }
    )
    const onDragEndObserver = dragManager.onDragEndObservable.add(() => {
      clearTimeout(timeout)
      isDragging = false
    })
    const onOutObserver = multiSelectionManager.onOutObservable.add(() => {
      clearTimeout(timeout)
      isDragging = false
      object = null
    })

    return () => {
      multiSelectionManager.onOverObservable.remove(onOverObserver)
      multiSelectionManager.onOutObservable.remove(onOutObserver)
      dragManager.onDragStartObservable.remove(onDragStartObserver)
      dragManager.onDragEndObservable.remove(onDragEndObserver)
    }
  })
</script>

<style>
  div {
    position: absolute;
    height: auto;
    width: auto;
    display: inline-flex;
    flex-direction: column;
    visibility: hidden;
  }
</style>

<div
  style={`visibility: ${
    object ? 'visible' : 'hidden'
  }; left: ${left}px; top: ${top}px`}
  on:pointerdown|stopPropagation
>
  {#each actions as { name, action }}
    <button on:click={action}>{name}</button>
  {/each}
</div>
