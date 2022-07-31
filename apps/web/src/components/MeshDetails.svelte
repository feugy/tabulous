<script>
  import { afterUpdate, createEventDispatcher } from 'svelte'
  import { gameAssetsUrl } from '../utils'

  export let mesh = null

  const dispatch = createEventDispatcher()
  let previous
  let isListeningKey = false
  $: open = Boolean(mesh)
  $: if (open) {
    setTimeout(() => (isListeningKey = true), 100)
  } else {
    isListeningKey = false
  }

  afterUpdate(() => {
    if (previous !== mesh) {
      dispatch(previous ? 'close' : 'open')
      previous = mesh
    }
  })

  function handleClose() {
    mesh = null
  }

  function handleKey() {
    if (isListeningKey) {
      handleClose()
    }
  }
</script>

<svelte:window on:keydown={handleKey} />

{#if open}
  <figure class:open on:click={handleClose}>
    <img src="{gameAssetsUrl}{mesh?.image}" alt="" />
  </figure>
{/if}

<style lang="postcss">
  figure {
    @apply invisible flex absolute z-10 inset-0 justify-center pointer-events-none py-[5%] px-0;

    &.open {
      @apply visible pointer-events-auto bg-$base-dark;

      & img {
        @apply opacity-100 translate-y-0;
      }
    }
  }

  img {
    @apply h-full w-auto opacity-0 transition-all duration-500 transform-gpu translate-y-10;
  }
</style>
