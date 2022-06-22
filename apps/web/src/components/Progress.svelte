<svg class="animate-spin" role="progressbar" viewBox="22 22 44 44">
  <circle cx="44" cy="44" r="20.2" fill="none" stroke-width="3.6" />
</svg>

<style lang="postcss">
  svg {
    @apply inline-block w-10 h-10 m-4;
  }

  circle {
    @apply stroke-$primary stroke-offset-0;
    stroke-dasharray: 80px, 200px;
  }
</style>
