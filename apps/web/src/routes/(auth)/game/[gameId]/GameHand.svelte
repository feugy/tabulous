<script>
  import { MinimizableSection } from '@src/components'
  import { beforeUpdate } from 'svelte'
  import { _ } from 'svelte-intl'

  export let visible = false
  export let meshes = []
  export let node
  export let highlight = false
  export let color = '#00ff00'

  let meshCount = meshes?.length ?? 0
  let minimized = meshCount === 0

  beforeUpdate(() => {
    const count = meshes?.length ?? 0
    if (meshCount > 0 && count === 0) {
      minimized = true
    } else if (meshCount === 0 && count > 0) {
      minimized = false
    }
    meshCount = count
  })
</script>

<aside class:highlight class:visible style="--color: {color}">
  <MinimizableSection
    placement="bottom"
    tabs={[{ icon: 'front_hand', key: $_('shortcuts.hand') }]}
    dimension="25vh"
    {minimized}><div class="hand" bind:this={node} /></MinimizableSection
  >
</aside>

<style lang="postcss">
  aside {
    @apply absolute inset-0 top-auto pointer-events-none hidden;

    &.visible {
      @apply block;
    }

    &.highlight:before {
      @apply block relative w-full border border-solid border-opacity-50;
      content: '';
      border-top-width: 50px;
      border-image: radial-gradient(
          farthest-side ellipse at bottom center,
          var(--color),
          rgba(0, 0, 0, 0)
        )
        100% 0 0 0;
    }
  }

  .hand {
    @apply flex flex-col h-full items-stretch;
  }
</style>
