<script>
  // @ts-check
  /** @typedef {import('@tabulous/server/src/graphql').Mesh} Mesh */

  import { MinimizableSection } from '@src/components'
  import { beforeUpdate } from 'svelte'
  import { _ } from 'svelte-intl'

  /** @type {boolean} whether the hand is visible. */
  export let visible = false
  /** @type {Mesh[]|undefined} list of meshes in hand. */
  export let meshes = []
  /** @type {?HTMLDivElement} reference to the hand container. */
  export let node
  /** @type {boolean} whether the hand should be highlighted. */
  export let highlight = false
  /** @type {string} highlight color: hex string or color name. */
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

<aside
  class:highlight
  class:visible
  style="--color: {color}"
  on:pointerdown|stopPropagation
>
  <MinimizableSection
    placement="bottom"
    tabs={[{ icon: 'front_hand', key: $_('shortcuts.hand'), id: 'hand' }]}
    dimension="25vh"
    {minimized}><div class="hand" bind:this={node} /></MinimizableSection
  >
  {#if meshCount > 0}<strong>{meshCount}</strong>{/if}
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
      border-top-width: 51px;
      border-image: radial-gradient(
          farthest-side ellipse at bottom center,
          var(--color),
          rgba(0, 0, 0, 0)
        )
        100% 0 0 0;
    }

    &.highlight > strong {
      @apply top-0;
    }
  }

  strong {
    @apply absolute rounded-full leading-4 text-sm p-0.5
         flex justify-center items-center bg-$base-light
         -top-13 left-20 min-w-5 z-10;
  }

  .hand {
    @apply flex flex-col h-full items-stretch;
  }
</style>
