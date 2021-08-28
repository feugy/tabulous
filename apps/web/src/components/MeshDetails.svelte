<script>
  import { afterUpdate, createEventDispatcher } from 'svelte'

  export let mesh

  const dispatch = createEventDispatcher()
  let previous

  afterUpdate(() => {
    if (!previous) {
      previous = mesh
    } else if (previous !== mesh) {
      dispatch(previous ? 'close' : 'open')
      previous = mesh
    }
  })
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

<figure class:open={Boolean(mesh)} on:click={() => (mesh = null)}>
  <img src={mesh?.image} alt="" />
</figure>
