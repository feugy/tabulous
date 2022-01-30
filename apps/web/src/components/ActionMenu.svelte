<script>
  import { _ } from 'svelte-intl'
  import RadialMenu from './RadialMenu.svelte'
  import { shuffle } from '../utils'
  import { getMeshScreenPosition } from '../3d/utils'

  export let mesh

  let open = false
  let x = 0
  let y = 0
  let stackSize = 0
  let actions = []

  $: {
    actions = []
    open = Boolean(mesh)
    if (open) {
      ;({ x, y } = getMeshScreenPosition(mesh)) // eslint-disable-line no-extra-semi
      stackSize = mesh.metadata.stack?.length ?? 0
      if (mesh.metadata.flip) {
        actions.push({
          icon: 'flip',
          title: $_('tooltips.flip'),
          onClick: () => mesh.metadata.flip()
        })
      }
      if (mesh.metadata.rotate) {
        actions.push({
          icon: 'rotate_right',
          title: $_('tooltips.rotate'),
          onClick: () => mesh.metadata.rotate()
        })
      }
      if (mesh.metadata.stack?.length > 1) {
        actions.push({
          icon: 'shuffle',
          title: $_('tooltips.shuffle'),
          onClick: () => {
            const ids = mesh.metadata.stack.map(({ id }) => id)
            mesh.metadata.reorder(shuffle(ids))
          }
        })
      }
      if (mesh.metadata.detail) {
        actions.push({
          icon: 'visibility',
          title: $_('tooltips.detail'),
          onClick: () => mesh.metadata.detail()
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
