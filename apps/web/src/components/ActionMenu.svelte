<script>
  import { _ } from 'svelte-intl'
  import RadialMenu from './RadialMenu.svelte'
  import { shuffle } from '../utils'
  import { getMeshScreenPosition } from '../3d/utils'

  export let object

  let open = false
  let x = 0
  let y = 0
  let stackSize = 0
  let actions = []

  $: {
    actions = []
    open = Boolean(object)
    if (open) {
      ;({ x, y } = getMeshScreenPosition(object)) // eslint-disable-line no-extra-semi
      stackSize = object.metadata.stack?.length ?? 0
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
            object.metadata.reorder(shuffle(ids))
          }
        })
      }
      if (object.metadata.detail) {
        actions.push({
          icon: 'visibility',
          title: $_('tooltips.detail'),
          onClick: () => object.metadata.detail()
        })
      }
    }
  }
</script>

<style lang="postcss">
  .stack {
    @apply inline-block h-auto w-auto font-bold text-xl pointer-events-none text-$primary-lightest;
    -webkit-text-stroke-width: 1px;
    -webkit-text-stroke-color: var(--primary-dark);
  }
</style>

<RadialMenu {x} {y} {open} items={actions}>
  {#if stackSize > 1}
    <span class="stack">{stackSize}</span>
  {/if}
</RadialMenu>
