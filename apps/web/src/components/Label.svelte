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
  style="top: {screenPosition.y}px; left: {screenPosition.x}px; --color:{color}; pointer-events:{onClick
    ? 'auto'
    : 'none'};"
  class:hovered
  class:colored={Boolean(color)}
  on:click={interact}
  on:keydown={interact}
  on:pointerdown|stopPropagation
>
  {content}
</div>

<style lang="postcss">
  div {
    @apply absolute transform-gpu rounded-full min-w-8 p-1 text-center
            select-none opacity-60 text-$ink-dark bg-$secondary-dark
            -translate-y-[125%] -translate-x-[50%];

    &.colored {
      background-color: var(--color);

      &::after {
        background-color: var(--color);
      }
    }

    &::after {
      @apply absolute bg-$secondary-dark h-1.5;
      top: 95%;
      left: 35%;
      right: 35%;
      content: '';
      clip-path: polygon(0% 0%, 100% 0%, 50% 100%);
    }

    &.hovered,
    &:hover {
      @apply opacity-100;
    }
  }
</style>
