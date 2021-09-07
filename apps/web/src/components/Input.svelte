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

<style type="postcss">
  fieldset {
    @apply relative flex-grow my-2;

    &:focus-within legend {
      transform: translate(0, -1em) scale(0.75);
    }
  }

  legend {
    @apply absolute top-1 pointer-events-none;
    transform-origin: top left;
    transition: all theme('transitions.short') ease-in-out;

    &.has-value {
      transform: translate(0, -1em) scale(0.75);
    }
  }

  input {
    @apply py-1 w-full border-b;
    border-color: theme('colors.secondary.light');
    transition: border-color theme('transitions.short') ease-in-out;

    &:focus {
      @apply outline-none;
      border-color: theme('colors.primary.light');
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
