<script>
  export let text = null
  export let icon = null
  export let secondary = false
</script>

<style type="postcss">
  button {
    @apply py-2 px-4 rounded;
    background-color: theme('colors.primary.main');
    color: theme('colors.primary.text');
    transition: all theme('transitions.short') ease-in-out;

    &:focus {
      background-color: theme('colors.primary.light');
    }

    &:hover:not(:disabled) {
      background-color: theme('colors.primary.light');
      transform: scale(1.05);
    }

    &.secondary:disabled,
    &:disabled {
      background-color: theme('colors.disabled.main');
      color: theme('colors.disabled.text');
    }
  }

  button.secondary {
    background-color: theme('colors.secondary.main');
    color: theme('colors.secondary.text');

    &:focus {
      background-color: theme('colors.secondary.light');
    }

    &:hover:not(:disabled) {
      background-color: theme('colors.secondary.light');
    }
  }

  .material-icons {
    @apply -mx-2;
    & + .text {
      @apply ml-4;
    }
  }
</style>

<button {...$$restProps} class:secondary on:click
  >{#if icon}<span class="material-icons">{icon}</span>{/if}{#if text}<span
      class="text">{text}</span
    >{/if}</button
>
