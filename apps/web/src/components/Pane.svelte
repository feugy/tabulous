<script>
  export let title = null
  export let heading = 2
</script>

<section class="pane">
  {#if title}
    <svelte:element this={`h${heading}`}>{title}</svelte:element>
  {/if}
  <slot />
</section>

<style lang="postcss">
  .pane {
    @apply px-8 py-6 bg-$base-lightest rounded shadow-md;
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
