<script>
  export let text = null
  export let icon = null
  export let badge = null
  export let primary = false
  export let transparent = false
  export let ref = null
</script>

<button
  {...$$restProps}
  class:primary
  class:transparent
  class:has-text={Boolean(text)}
  bind:this={ref}
  on:click
  on:keyup
  on:keydown
  on:pointerup
  on:pointerdown
  >{#if icon}<span class="material-icons">{icon}</span
    >{:else if $$slots.icon}<span class="icon"><slot name="icon" /></span
    >{/if}{#if text}<span class="text">{text}</span
    >{/if}{#if badge != undefined}<span class="badge"
      >{badge > 999 ? `+999` : badge}</span
    >{/if}<slot /></button
>

<style lang="postcss">
  button {
    @apply py-2 px-4 inline-flex justify-center items-center relative transition-all duration-$short;
    --shadow-drop: 3px 3px;
    filter: drop-shadow(var(--shadow-drop) 0px var(--shadow-color));

    &:hover:not(:disabled) {
      @apply transform-gpu scale-105;
    }

    &.primary:disabled,
    &:disabled {
      @apply bg-$disabled text-$ink-dark;
    }

    &.has-text:not(.transparent) {
      @apply bg-transparent;

      &:before {
        @apply absolute inset-0 transition-all duration-$short;
        z-index: -1;
        content: '';

        --corner-cut: 8px;
        clip-path: polygon(
          0 var(--corner-cut),
          var(--corner-cut) 0,
          100% 0,
          100% calc(100% - var(--corner-cut)),
          calc(100% - var(--corner-cut)) 100%,
          0 100%
        );
      }

      &.primary:disabled,
      &:disabled {
        &:before {
          @apply bg-$disabled;
        }
      }
    }

    & .badge {
      @apply absolute rounded-full leading-4 text-xs p-0.5
         flex justify-center items-center bg-$primary-darker 
         text-$ink-dark -top-2 -left-2 min-w-5;
    }
  }

  button {
    @apply bg-$secondary text-$ink;

    &.has-text {
      @apply bg-transparent;

      &:before {
        @apply bg-$secondary;
      }

      &:focus,
      &:hover:not(:disabled) {
        @apply bg-transparent  text-$ink;

        &:before {
          @apply bg-$secondary-light;
        }
      }
    }

    &:not(.has-text) {
      &:focus,
      &:hover:not(:disabled) {
        @apply bg-$secondary-light text-$ink;
      }
    }

    & .badge {
      @apply bg-$secondary-darker;
    }
  }

  button.primary {
    @apply bg-$primary text-$ink;

    &.has-text {
      @apply bg-transparent;

      &:before {
        @apply bg-$primary;
      }

      &:focus,
      &:hover:not(:disabled) {
        @apply bg-transparent  text-$ink;

        &:before {
          @apply bg-$primary-light;
        }
      }
    }

    &:not(.has-text) {
      &:focus,
      &:hover:not(:disabled) {
        @apply bg-$primary-light text-$ink;
      }
    }

    & .badge {
      @apply bg-$primary-darker;
    }
  }

  button.transparent {
    @apply bg-transparent text-$secondary-darker;
    filter: none;

    &.primary {
      @apply text-$primary-dark;
    }

    &:focus,
    &:hover:not(:disabled) {
      @apply bg-transparent text-$secondary-darkest;

      &.primary {
        @apply text-$primary-darker;
      }
    }

    &.has-text:before {
      @apply bg-transparent;
    }
  }

  .material-icons,
  .icon {
    @apply -mx-2;
    & + .text {
      @apply ml-4;
    }
  }
  .icon:not(:last-child) {
    @apply -ml-1;
  }
</style>
