<script>
  // @ts-check
  /** @type {string} label's content. */
  export let content
  /** @type {undefined|(() => void)} an optional callback when label is clicked. */
  export let onClick
  /** @type {boolean|undefined} whether this label is currently hovered. */
  export let hovered
  /** @type {import('@src/3d/utils').ScreenPosition} absolute screen position for this label (0,0 by default). */
  export let screenPosition = { x: 0, y: 0 }
  /** @type {string|undefined} label's color (hexcode or color name). */
  export let color = undefined

  function interact() {
    onClick?.()
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  style="top: {screenPosition.y}px; left: {screenPosition.x}px; --color:{color ??
    '#7a7a7a'}; pointer-events:{onClick ? 'auto' : 'none'};"
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
