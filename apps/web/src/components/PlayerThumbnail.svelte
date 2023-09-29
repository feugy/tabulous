<script>
  // @ts-check
  import { abbreviate } from '../utils'

  /** @type {import('@src/graphql').Player & { color?: string }} displayed player. */
  export let player = { id: '', username: '' }
  /** @type {number} size for this thumbnail. */
  export let dimension = 60
  /** @type {?import('@src/3d/utils').ScreenPosition} optional screen position, relative to the absolute parent. */
  export let screenPosition = null

  $: isShort = dimension < 60
  $: hasImage = Boolean(player?.avatar)
  $: caption = isShort ? abbreviate(player?.username) : player?.username
  $: style = formatVariables()

  function formatVariables() {
    return [
      `--dimension: ${dimension}px`,
      `--color: ${player?.color}`,
      `--top: ${screenPosition?.y}px`,
      `--left: ${screenPosition?.x}px`,
      `--border-width: ${isShort ? 0 : dimension < 100 ? 3 : 5}px`
    ].join('; ')
  }
</script>

<figure
  class:positioned={!!screenPosition}
  class:colored={!!player?.color}
  {style}
>
  <img
    class:hasImage
    src={player?.avatar}
    width={dimension}
    height={dimension}
    alt="avatar for {player?.username}"
    referrerpolicy="no-referrer"
    on:load={() => (hasImage = true)}
  />
  {#if !hasImage}
    <figcaption class:abbreviated={isShort}>{caption}</figcaption>
  {/if}
</figure>

<style lang="postcss">
  figure {
    @apply flex flex-shrink-0 items-center justify-center rounded-full;
    height: var(--dimension);
    width: var(--dimension);

    &.positioned {
      @apply absolute transform-gpu -translate-y-full;
      border-bottom-left-radius: 0;
      left: var(--left);
      top: var(--top);
    }
    &.colored {
      background-color: var(--color);
      padding: var(--border-width);

      figcaption {
        @apply bg-transparent;
      }
    }

    > * {
      @apply rounded-full h-full w-full;
    }
  }

  figcaption {
    @apply flex items-center justify-center p-1 text-$ink-dark text-center  bg-$base-darkest;

    &.abbreviated {
      @apply whitespace-nowrap;
    }
  }

  img {
    @apply bg-$primary-lightest hidden;

    &.hasImage {
      @apply block;
    }
  }
</style>
