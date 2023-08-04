<script>
  // @ts-check
  /** @typedef {import('@src/3d/managers/control').MeshDetails['data']} MeshDetails */

  import { gameAssetsUrl, injectLocale } from '@src/utils'
  import { afterUpdate, createEventDispatcher } from 'svelte'
  import { locale } from 'svelte-intl'

  /** @type {?MeshDetails} */
  export let mesh = null

  /** @type {import('svelte').EventDispatcher<{ close: void, open: void }>} */
  const dispatch = createEventDispatcher()
  /** @type {?MeshDetails} */
  let previous = null
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
  <button
    class:open
    on:click={handleClose}
    on:keydown={handleKey}
    on:pointerdown|stopPropagation
  >
    <img
      src="{gameAssetsUrl}{injectLocale(
        /** @type {MeshDetails} */ (mesh).image,
        'images',
        $locale
      )}"
      alt=""
    />
  </button>
{/if}

<style lang="postcss">
  button {
    @apply invisible flex absolute z-10 inset-0 w-full justify-center items-center pointer-events-none py-[5%] px-0 max-w-9/10 m-x-auto;

    &.open {
      @apply visible pointer-events-auto;

      & img {
        @apply opacity-100 translate-y-0;
      }
    }
  }

  img {
    @apply h-full w-full object-contain opacity-0 transition-all duration-500 transform-gpu translate-y-10;
  }
</style>
