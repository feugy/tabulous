<script>
  export let text = null
  export let icon = null
  export let badge = null
  export let secondary = false
  export let ref = null
</script>

<button
  {...$$restProps}
  class:secondary
  bind:this={ref}
  on:click
  on:pointerup
  on:pointerdown
  >{#if icon}<span class="material-icons">{icon}</span>{/if}{#if text}<span
      class="text">{text}</span
    >{/if}{#if badge != undefined}<span class="badge"
      >{badge > 999 ? `+999` : badge}</span
    >{/if}<slot /></button
>

<style lang="postcss">
  button {
    @apply py-2 px-4 inline-flex justify-center items-center rounded relative bg-$primary text-$primary-lightest 
           transition-all duration-$short;

    &:focus {
      @apply bg-$primary-light;
    }

    &:hover:not(:disabled) {
      @apply bg-$primary-light transform-gpu scale-105;
    }

    &.secondary:disabled,
    &:disabled {
      @apply bg-$disabled text-$disabled-dark;
    }
  }

  button.secondary {
    @apply bg-$secondary text-$secondary-lightest;

    &:focus {
      @apply bg-$secondary-light;
    }

    &:hover:not(:disabled) {
      @apply bg-$secondary-light;
    }
  }

  .material-icons {
    @apply -mx-2;
    & + .text {
      @apply ml-4;
    }
  }

  .badge {
    @apply absolute rounded-full leading-4 text-xs p-1 
           flex justify-center items-center bg-$disabled 
           text-$disabled-dark -top-2 -left-2 min-w-6;
  }
</style>
