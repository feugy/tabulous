<script>
  import { createEventDispatcher } from 'svelte'

  export let placeholder = null
  export let value = ''
  export let ref = null
  export let disabled = false

  const dispatch = createEventDispatcher()

  function handleKey(event) {
    if (event.key === 'Enter') {
      dispatch('enter', { value })
    }
  }
</script>

<fieldset>
  {#if placeholder}<legend
      class:has-value={!!value}
      class:disabled={disabled === true}>{placeholder}</legend
    >{/if}
  <input
    {...$$restProps}
    bind:value
    bind:this={ref}
    {disabled}
    on:focus
    on:blur
    on:input
    on:keyup
    on:keydown
    on:keyup={handleKey}
  />
</fieldset>

<style lang="postcss">
  fieldset {
    @apply relative flex-grow my-2;

    &:focus-within legend {
      @apply transform-gpu -translate-y-4 scale-75;
    }
  }

  legend {
    @apply absolute top-1 pointer-events-none transition-transform duration-$short origin-top-left text-$base-darkest;

    &.has-value {
      @apply transform-gpu -translate-y-4 scale-75;
    }

    &.disabled {
      @apply text-$ink-dark;
    }
  }

  input {
    @apply py-1 w-full border-b border-$base-darker bg-transparent transition duration-$short text-$primary-darkest;

    &:focus {
      @apply outline-none border-$primary-darker;
    }
    &:disabled {
      @apply text-$ink-dark;
    }
  }
</style>
