<script>
  import { afterUpdate, createEventDispatcher, onMount } from 'svelte'
  import Portal from 'svelte-portal/src/Portal.svelte'
  import Button from './Button.svelte'
  import Pane from './Pane.svelte'

  export let open
  export let title
  export let closable = true

  const dispatch = createEventDispatcher()
  let previous = null

  onMount(() => {
    if (open) {
      dispatch('open')
    }
  })

  afterUpdate(() => {
    if (previous === null) {
      previous = open
    } else if (previous !== open) {
      dispatch(previous ? 'close' : 'open')
      previous = open
    }
  })

  function close() {
    if (closable) {
      open = false
    }
  }

  function handleKeyup({ key }) {
    if (key === 'Escape') {
      close()
    }
  }
</script>

<style lang="postcss">
  .backdrop,
  .filter {
    @apply fixed flex items-center justify-center 
           inset-0 m-0 z-10 p-10 opacity-0 
           transition duration-$short pointer-events-none;

    &.open {
      @apply opacity-100 pointer-events-auto;
    }
  }

  .filter {
    @apply bg-$base-dark delay-150;

    &.open {
      @apply opacity-90 backdrop-filter backdrop-blur-sm;
    }
  }

  .close-container {
    @apply absolute top-0 right-0 m-4;
  }

  article {
    @apply flex flex-col w-full max-h-full
           md:w-10/12 lg:w-9/12 xl:w-7/12;
  }

  .content {
    @apply overflow-y-auto;
  }

  header {
    @apply inline-block;
  }

  footer {
    @apply mt-4 text-center;
  }
</style>

<svelte:body on:keyup={handleKeyup} />
<Portal>
  <div class="filter" class:open />
  <div class="backdrop" class:open on:click={close}>
    {#if closable}
      <span class="close-container">
        <Button icon="close" on:click={close} />
      </span>
    {/if}
    <article role="dialog" on:click|stopPropagation>
      <Pane>
        <header class="heading">{title}</header>
        <div class="content">
          <slot />
        </div>
        <footer>
          <slot name="buttons" />
        </footer>
      </Pane>
    </article>
  </div>
</Portal>
