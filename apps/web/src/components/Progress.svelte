<script>
  export let radius = 35
</script>

<svg
  class="animate-spin"
  role="progressbar"
  viewBox="0 0 {radius * 4} {radius * 4}"
  width={radius * 2}
>
  <circle
    cx={radius * 2}
    cy={radius * 2}
    r={radius}
    fill="none"
    stroke-width={radius / 5.6}
    stroke-dasharray="{radius * 4}px, {radius * 10}px"
  />
</svg>

<style lang="postcss">
  svg {
    @apply inline-block;
  }

  circle {
    @apply stroke-$primary-dark stroke-offset-0;
  }
</style>
