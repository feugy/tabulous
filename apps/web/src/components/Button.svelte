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
  ><div>
    {#if icon}<span class="material-icons">{icon}</span
      >{:else if $$slots.icon}<span class="icon"><slot name="icon" /></span
      >{/if}{#if text}<span class="text">{text}</span>{/if}<slot />
  </div>
  {#if badge != undefined}
    <span class="badge">{badge > 999 ? `+999` : badge}</span>
  {/if}</button
>

<style lang="postcss">
  button {
    @apply relative bg-$base rounded text-$ink transition-all duration-$short leading-none;
    --shadow-drop: 0 3px;
    --corner: 20px;
    filter: drop-shadow(
      var(--shadow-drop) var(--shadow-blur) var(--shadow-color)
    );

    &::before {
      @apply absolute inset-0 h-full w-full bg-$base-light pointer-events-none rounded transition-all duration-$long;
      content: '';
      clip-path: polygon(
        0 calc(100% - var(--corner)),
        0 100%,
        var(--corner) 100%,
        var(--corner) 100%
      );
    }

    div {
      @apply relative inline-flex justify-center items-center py-2 px-4;
    }

    &:not(:disabled) {
      &:hover,
      &:focus {
        @apply transform-gpu scale-105;

        &::before {
          clip-path: polygon(0 0, 0 100%, 100% 100%, 100% 0);
        }
      }
    }

    &.primary:disabled,
    &:disabled {
      @apply bg-$disabled text-$ink-dark;
    }

    & .badge {
      @apply absolute rounded-full leading-4 text-xs p-0.5
         flex justify-center items-center bg-$base-darkest
         text-$ink-dark -top-2 -left-2 min-w-5;
    }
  }

  button:not(.has-text) {
    @apply rounded-full;
    &::before {
      @apply rounded-full;
    }
  }

  button.primary:not(:disabled) {
    @apply bg-$primary text-$ink;
    filter: drop-shadow(
      var(--shadow-drop) var(--shadow-blur) var(--primary-darker)
    );

    &::before {
      @apply bg-$primary-light;
    }

    & .badge {
      @apply bg-$primary-darkest;
    }
  }

  button.transparent {
    @apply bg-transparent text-$base-darkest;
    filter: none;

    &::before {
      @apply invisible;
    }

    &.primary {
      @apply bg-transparent text-$primary-darkest;
      filter: none;
    }

    &:focus,
    &:hover:not(:disabled) {
      @apply bg-transparent text-$base-darker;

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
