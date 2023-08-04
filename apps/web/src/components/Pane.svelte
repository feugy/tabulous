<script>
  // @ts-check

  /** @type {?string} this pane's title. */
  export let title = null
  /** @type {number} HTML heading level used (defaults to 2). */
  export let heading = 2
  /** @type {'base'|'primary'|'secondary'} color scheme used (defaults to 'base'). */
  export let backgroundColor = 'base'
</script>

<section class="pane" style:--bg="var(--{backgroundColor}-lightest)">
  {#if title}
    <svelte:element this={`h${heading}`}>{title}</svelte:element>
  {/if}
  <slot />
</section>

<style lang="postcss">
  .pane {
    @apply px-8 py-6 rounded shadow-md;
    background: var(--card-light) var(--bg);
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    @apply block text-2xl px-4 py-4 -mt-4 
            border-b-2 border-$base-dark;
    font-family: var(--font-heading);
  }
</style>
