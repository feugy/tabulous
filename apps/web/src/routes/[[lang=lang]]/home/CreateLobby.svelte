<script>
  // @ts-check
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  /** @type {import('svelte').EventDispatcher<{ select: void }>}*/
  const dispatch = createEventDispatcher()

  function handleClick() {
    dispatch('select')
  }
</script>

<button tabindex="0" on:click={handleClick}>
  <legend>
    <h3>{$_('actions.create-lobby')}</h3>
    <div>{$_('labels.lobby-description')}</div>
  </legend>
</button>

<style lang="postcss">
  button {
    @apply relative cursor-pointer bg-$secondary-darkest text-left rounded transition-all duration-$short overflow-hidden;
    grid-template-areas: 'full';
    box-shadow: 0px 3px 10px var(--shadow-color);

    &::after {
      @apply absolute -inset-1/2 transition-all duration-$long;
      background: var(--card-light);
      content: '';
    }

    &:hover {
      @apply bg-$base-darkest;
      transform: perspective(450px) rotate3d(1, 0, 0, 5deg)
        scale3d(1.05, 1.05, 1.05) translate3d(0, -4px, 0);
      box-shadow: 0px 1rem 10px var(--shadow-color);

      h3 {
        @apply text-$primary-light;
      }

      &::after {
        background-position: 1rem 0;
      }
    }
  }

  legend {
    @apply p-4 text-$ink-dark;
  }

  h3 {
    @apply mb-4 transition-colors duration-$long delay-$short;
  }
</style>
