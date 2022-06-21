<script>
  export let player
  export let screenPosition = { x: 0, y: 0 }
  export let color = '#979797'

  let hasImage = false
</script>

<style lang="postcss">
  figure {
    @apply absolute flex relative 
            rounded-full border-3 
            items-center justify-center 
            transform-gpu -translate-y-full;
    background-color: var(--color);
    border-bottom-left-radius: 0;
    border-color: var(--color);
    height: 60px;
    left: var(--left);
    top: var(--top);
    width: 60px;

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

<figure
  style={`--color:${color}; --top:${screenPosition.y}px; --left:${screenPosition.x}px`}
>
  <img
    class:hasImage
    src={player.avatar}
    alt="Pointer of player {player.username}"
    on:load={() => (hasImage = true)}
  />
  {#if !hasImage}
    <figcaption>{player.username}</figcaption>
  {/if}
</figure>
