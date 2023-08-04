<script>
  // @ts-check
  import { afterUpdate, createEventDispatcher, onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import Portal from 'svelte-portal'

  import Button from './Button.svelte'
  import Pane from './Pane.svelte'

  /** @type {boolean} whether this dialogur is open. */
  export let open
  /** @type {string} dialogue main title. */
  export let title
  /** @type {boolean} whether this dialogue could be closed by clicking on the backdrop or hitting ESC key. */
  export let closable = true

  /** @type {import('svelte').EventDispatcher<{ close: void, open: void }>}*/
  const dispatch = createEventDispatcher()
  /** @type {number} */
  const duration = 150
  /** @type {?boolean} */
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

  function handleKey(/** @type {KeyboardEvent} */ { key }) {
    if (key === 'Escape') {
      close()
    }
  }
</script>

<svelte:body on:keyup={handleKey} />
<Portal>
  {#if open}
    <div class="filter" />
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="backdrop"
      on:click={close}
      on:keydown|stopPropagation
      on:keyup={handleKey}
    >
      {#if closable}
        <span class="close-container">
          <Button icon="close" on:click={close} />
        </span>
      {/if}
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <article
        role="dialog"
        in:fly|global={{ y: -100, duration }}
        on:click|stopPropagation
        on:keyup|stopPropagation={handleKey}
      >
        <Pane {title} backgroundColor="primary">
          <div class="content">
            <slot />
          </div>
          <footer>
            <slot name="buttons" />
          </footer>
        </Pane>
      </article>
    </div>
  {/if}
</Portal>

<style lang="postcss">
  .backdrop,
  .filter {
    @apply fixed flex items-center justify-center 
           inset-0 m-0 z-10 p-10;
  }

  .filter {
    @apply bg-$base-darker opacity-90 backdrop-filter backdrop-blur-sm;
  }

  .close-container {
    @apply absolute top-0 right-0 m-4;
  }

  article {
    @apply flex flex-col w-full max-h-full
           md:w-10/12 lg:w-9/12 xl:w-7/12;
    box-shadow: 0 10px 8px var(--shadow-color);
  }

  .content {
    @apply overflow-y-auto mt-4;
  }

  footer {
    @apply mt-8 justify-center flex gap-4;
  }
</style>
