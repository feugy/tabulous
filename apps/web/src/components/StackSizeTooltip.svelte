<script>
  export let size
  let position
</script>

<style type="postcss">
  div {
    @apply absolute invisible inline-block h-auto w-auto -mt-8 ml-4 font-bold text-xl pointer-events-none;
    color: theme('colors.primary.text');
    -webkit-text-stroke-width: 1px;
    -webkit-text-stroke-color: theme('colors.primary.dark');

    &.active {
      @apply visible;
    }
  }
</style>

<svelte:body on:mousemove={event => (position = event)} />
<div
  class:active={size}
  style={`left: ${position?.x}px; top: ${position?.y}px`}
>
  {size}
</div>
