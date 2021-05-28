<script>
  import { onMount } from 'svelte'
  import { _ } from 'svelte-intl'
  import { RadialMenu } from '../components'
  import { getMeshCoordinates, shuffle } from '../utils'
  import {
    detail,
    dragStart,
    dragEnd,
    pointerOut,
    pointerOver
  } from '../stores'

  const delay = 500
  let x = 0
  let y = 0
  let actions = []
  let isDragging = false
  let object
  let timeout
  let pointerOnMenu = false
  let hideOnMenuLeave = false

  onMount(() => {
    const subs = [
      pointerOver.subscribe(handlePointerOver),
      pointerOut.subscribe(handlePointerOut),
      dragStart.subscribe(handleDragStart),
      dragEnd.subscribe(handleDragEnd)
    ]
    return () => subs.map(sub => sub.unsubscribe())
  })

  function handlePointerOver({ mesh }) {
    clearTimeout(timeout)
    // show menu unless drag in progress
    if (!object && !isDragging) {
      timeout = setTimeout(() => {
        object = mesh
        ;({ x, y } = getMeshCoordinates(object))
        actions = []
        if (object.metadata.flip) {
          actions.push({
            icon: 'flip',
            title: $_('tooltips.flip'),
            onClick: () => object.metadata.flip()
          })
        }
        if (object.metadata.rotate) {
          actions.push({
            icon: 'rotate_right',
            title: $_('tooltips.rotate'),
            onClick: () => object.metadata.rotate()
          })
        }
        if (object.metadata.stack?.length > 1) {
          actions.push({
            icon: 'shuffle',
            title: $_('tooltips.shuffle'),
            onClick: () => {
              const ids = object.metadata.stack.map(({ id }) => id)
              object.metadata.shuffle(shuffle(ids))
            }
          })
        }
        if (object.metadata.images) {
          actions.push({
            icon: 'visibility',
            title: $_('tooltips.detail'),
            onClick: () => detail.next({ mesh })
          })
        }
      }, delay)
    }
  }

  function handleDragStart({ mesh }) {
    clearTimeout(timeout)
    isDragging = true
    // hide menu when dragging another mesh than current
    if (mesh.id === object?.id) {
      object = null
    }
  }

  function handleDragEnd() {
    clearTimeout(timeout)
    isDragging = false
  }

  function handlePointerOut() {
    // hide menu when pointer leaves current mesh, unless pointer is in menu
    clearTimeout(timeout)
    isDragging = false
    if (!pointerOnMenu) {
      object = null
    } else {
      hideOnMenuLeave = true
    }
  }

  function handlePointerOutMenu() {
    pointerOnMenu = false
    if (hideOnMenuLeave) {
      // hide menu since pointer is neither on menu, neither on mesh
      hideOnMenuLeave = false
      object = null
    }
  }
</script>

<RadialMenu
  {x}
  {y}
  open={object !== null}
  items={actions}
  on:mouseenter={() => (pointerOnMenu = true)}
  on:mouseleave={handlePointerOutMenu}
/>
