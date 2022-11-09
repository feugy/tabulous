<script>
  export let content
  export let screenPosition = { x: 0, y: 0 }
  export let centered = false
</script>

<div
  class:centered
  style="top: {screenPosition.y}px; left: {screenPosition.x}px"
>
  {content}
</div>

<style lang="postcss">
  div {
    @apply absolute transform-gpu -translate-y-1/2 -translate-x-1
            pointer-events-none 
            font-bold text-lg text-$primary-lightest
            bg-$primary opacity-85
            py-1 pr-2 pl-5 rounded z-10;
    clip-path: polygon(1rem 0%, 100% 0, 100% 100%, 1rem 100%, 0% 50%);

    &.centered {
      @apply p-2 pt-1 pb-3 rounded-none -translate-y-[100%] -translate-x-[50%];
      --offset: 85%;
      clip-path: polygon(
        0% 0%,
        100% 0%,
        100% var(--offset),
        65% var(--offset),
        50% 100%,
        35% var(--offset),
        0% var(--offset)
      );
    }
  }
</style>
