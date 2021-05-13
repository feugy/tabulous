<style type="postcss">
  .pane {
    @apply p-8 shadow-md;
    background: theme('backgrounds.primary');
  }
</style>

<div class="pane">
  <slot />
</div>
