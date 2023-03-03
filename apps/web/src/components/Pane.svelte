<script>
  export let title = null
  export let heading = 2
</script>

<span>
  <div class="pane">
    {#if title}
      <svelte:element this={`h${heading}`}>{title}</svelte:element>
    {/if}
    <slot />
  </div>
</span>

<style lang="postcss">
  .pane {
    @apply px-8 py-6 bg-$base-lighter;
    --corner-cut: 1rem;
    clip-path: polygon(
      0 var(--corner-cut),
      var(--corner-cut) 0,
      100% 0,
      100% calc(100% - var(--corner-cut)),
      calc(100% - var(--corner-cut)) 100%,
      0 100%
    );
  }

  span {
    --shadow-drop: 0.5rem 0.5rem;
    filter: drop-shadow(
      var(--shadow-drop) var(--shadow-blur) var(--shadow-color)
    );
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    @apply block text-2xl px-8 py-4 -mx-8 -mt-6 
            bg-$primary-dark text-$ink-dark
            border-b-2 border-$base-dark;
    font-family: var(--font-heading);
  }
</style>
