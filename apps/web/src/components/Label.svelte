<script>
  export let content
  export let onClick
  export let hovered
  export let screenPosition = { x: 0, y: 0 }
  export let color = '#7a7a7a'

  function interact() {
    onClick?.()
  }
</script>

<div
  style="top: {screenPosition.y}px; left: {screenPosition.x}px; --color:{color}; pointer-events:{onClick
    ? 'auto'
    : 'none'};"
  class:hovered
  on:click={interact}
  on:keydown={interact}
  on:pointerdown|stopPropagation
>
  {content}
</div>

<style lang="postcss">
  div {
    @apply absolute transform-gpu 
            select-none 
            text-lg text-$primary-lightest opacity-60
            rounded-md
            p-2 pt-1 pb-3 -translate-y-[100%] -translate-x-[50%];
    background-color: var(--color);
    --offset: 85%;
    clip-path: polygon(
      0% 0%,
      100% 0%,
      100% var(--offset),
      70% var(--offset),
      50% 100%,
      30% var(--offset),
      0% var(--offset)
    );

    &.hovered,
    &:hover {
      @apply opacity-100;
    }
  }
</style>
