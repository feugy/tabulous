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

    &::before {
      @apply absolute inset-0 border-b border-$primary-darker w-0 pointer-events-none;
      transition: width var(--medium) var(--medium);
      animation: 2s ease-in-out infinite highlight;
      content: '';
    }

    &:focus-within legend {
      @apply transform-gpu -translate-y-4 scale-75;
    }

    &:hover,
    &:focus-within {
      &::before {
        @apply w-full;
        animation: none;
      }
    }
  }

  @keyframes highlight {
    0% {
      @apply w-0;
    }
    20% {
      @apply w-full ml-[0%];
    }
    40% {
      @apply w-0 ml-[100%];
    }
  }

  legend {
    @apply absolute top-1 pointer-events-none transition-transform duration-$short
           origin-top-left text-$base-dark;
    font-family: var(--font-heading);

    &.has-value {
      @apply transform-gpu -translate-y-4 scale-75;
    }

    &.disabled {
      @apply text-$ink-dark;
    }
  }

  input {
    @apply py-1 w-full bg-transparent transition-colors duration-$medium;

    &:focus {
      @apply outline-none text-$primary-dark;
    }
    &:disabled {
      @apply text-$ink-dark;
    }
  }
</style>
