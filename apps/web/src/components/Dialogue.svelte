<script>
  import { afterUpdate, createEventDispatcher } from 'svelte'
  import Portal from 'svelte-portal'
  import { Button, Pane } from '.'

  export let open
  export let title
  export let closable = true

  const dispatch = createEventDispatcher()
  let previous = null

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

<style type="postcss">
  .backdrop,
  .filter {
    @apply invisible fixed flex items-center justify-center inset-0 m-0 z-10 p-10;
  }

  .filter.open {
    @apply visible;
    backdrop-filter: blur(4px);
  }

  .backdrop {
    @apply opacity-0;
    transition: all theme('transitions.short') ease-in-out;

    &.open {
      @apply opacity-100 visible;
    }
  }

  .close-container {
    @apply absolute top-0 right-0 m-4;
  }
  article {
    @apply flex flex-col w-full max-h-full;
    @apply md:w-10/12 lg:w-9/12 xl:w-7/12;
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
