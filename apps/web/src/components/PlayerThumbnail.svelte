<script>
  import { abbreviate } from '../utils'

  export let player = {}
  export let dimension = 60
  export let screenPosition = null
  export let color = null

  $: hasImage = player?.avatar
  let caption = dimension < 60 ? abbreviate(player?.username) : player?.username

  function formatVariables() {
    return [
      `--dimension: ${dimension}px`,
      `--color: ${color}`,
      `--top: ${screenPosition?.y}px`,
      `--left: ${screenPosition?.x}px`,
      `--border-width: ${dimension < 50 ? 0 : dimension < 100 ? 3 : 5}px`
    ].join('; ')
  }
</script>

<figure
  class:positioned={!!screenPosition}
  class:colored={!!color}
  style={formatVariables()}
>
  <img
    class:hasImage
    src={player?.avatar}
    width={dimension}
    height={dimension}
    alt="avatar for {player?.username}"
    on:load={() => (hasImage = true)}
  />
  {#if !hasImage}
    <figcaption>{caption}</figcaption>
  {/if}
</figure>

<style lang="postcss">
  figure {
    @apply flex items-center justify-center;
    @apply rounded-full border-$primary-light bg-$primary-light;
    height: var(--dimension);
    width: var(--dimension);
    border-width: var(--border-width);

    &.positioned {
      @apply absolute relative transform-gpu -translate-y-full;
      border-bottom-left-radius: 0;
      left: var(--left);
      top: var(--top);
    }
    &.colored {
      background-color: var(--color);
      border-color: var(--color);
    }

    > * {
      @apply rounded-full h-full w-full;
    }
  }

  figcaption {
    @apply flex items-center justify-center p-1 text-$primary-lightest text-center;
  }

  img {
    @apply bg-$primary-lightest hidden;

    &.hasImage {
      @apply block;
    }
  }
</style>
