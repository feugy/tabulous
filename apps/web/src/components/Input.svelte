<script>
  import { createEventDispatcher } from 'svelte'

  export let placeholder = null
  export let value = ''
  export let ref = null

  const dispatch = createEventDispatcher()

  function handleKey(event) {
    if (event.key === 'Enter') {
      dispatch('enter', { value })
    }
  }
</script>

<style lang="postcss">
  fieldset {
    @apply relative flex-grow my-2;

    &:focus-within legend {
      @apply transform-gpu -translate-y-4 scale-75;
    }
  }

  legend {
    @apply absolute top-1 pointer-events-none transition-transform duration-$short origin-top-left;

    &.has-value {
      @apply transform-gpu -translate-y-4 scale-75;
    }
  }

  input {
    @apply py-1 w-full border-b border-$secondary-light bg-transparent transition duration-$short;

    &:focus {
      @apply outline-none border-$primary-light;
    }
  }
</style>

<fieldset>
  {#if placeholder}<legend class:has-value={!!value}>{placeholder}</legend>{/if}
  <input
    {...$$restProps}
    bind:value
    bind:this={ref}
    on:focus
    on:blur
    on:input
    on:keyup
    on:keydown
    on:keyup={handleKey}
  />
</fieldset>
