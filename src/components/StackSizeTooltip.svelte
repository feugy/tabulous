<script>
  import { onMount } from 'svelte'
  import { StackBehavior } from '../3d/behaviors'
  import { multiSelectionManager } from '../3d/managers'

  let left = 0
  let top = 0
  let stackSize

  onMount(() => {
    const onOverObserver = multiSelectionManager.onOverObservable.add(
      ({ mesh, event: { clientX, clientY } }) => {
        const behavior = mesh.getBehaviorByName(StackBehavior.NAME)
        if (behavior?.base?.stack?.length > 1) {
          stackSize = behavior.base.stack.length
          left = clientX
          top = clientY
        }
      }
    )
    const onOutObserver = multiSelectionManager.onOutObservable.add(
      () => (stackSize = null)
    )
    return () => {
      multiSelectionManager.onOverObservable.remove(onOverObserver)
      multiSelectionManager.onOutObservable.remove(onOutObserver)
    }
  })
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
    stackSize ? 'visible' : 'hidden'
  }; left: ${left}px; top: ${top}px`}
>
  {stackSize}
</div>
