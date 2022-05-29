<script>
  import { beforeUpdate } from 'svelte'
  import MinimizableSection from './MinimizableSection.svelte'

  export let visible = false
  export let meshes = []
  export let node
  export let highlight = false

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

<style lang="postcss">
  aside {
    @apply absolute z-100 inset-0 top-auto pointer-events-none hidden;

    &.visible {
      @apply block;
    }

    &.highlight:before {
      @apply block relative w-full border border-solid border-opacity-50;
      content: '';
      border-top-width: 50px;
      border-image: radial-gradient(
          farthest-side ellipse at bottom center,
          rgba(0, 255, 0, var(--tw-border-opacity)),
          rgba(0, 0, 0, 0)
        )
        100% 0 0 0;
    }
  }

  .hand {
    @apply flex flex-col h-full items-stretch;
  }
</style>

<aside class:highlight class:visible>
  <MinimizableSection
    placement="bottom"
    tabs={[{ icon: 'front_hand', key: 'h' }]}
    dimension="25vh"
    {minimized}><div class="hand" bind:this={node} /></MinimizableSection
  >
</aside>
