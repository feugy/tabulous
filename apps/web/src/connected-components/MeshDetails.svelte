<script>
  import { onMount } from 'svelte'
  import { detail } from '../stores'

  let image = null

  onMount(() =>
    detail.subscribe(({ mesh }) => {
      image =
        mesh.metadata?.images?.[mesh.metadata?.isFlipped ? 'back' : 'front'] ??
        null
    })
  )

  function handleClose() {
    image = null
  }
</script>

<style type="postcss">
  figure {
    @apply flex absolute inset-0 justify-center pointer-events-none;
    padding: 5% 0;

    &.open {
      @apply pointer-events-auto;
      background-color: theme('backgrounds.backdrop');

      & img {
        @apply opacity-100 translate-y-0;
      }
    }
  }

  img {
    @apply h-full w-auto opacity-0 transition-all duration-500 transform-gpu translate-y-10;
  }
</style>

<figure class:open={image} on:click={handleClose}>
  <img src={image} alt="" />
</figure>
