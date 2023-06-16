<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

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
    @apply m-4 cursor-pointer bg-$secondary-darkest text-left rounded transition-all duration-$short;
    grid-template-areas: 'full';

    &:hover {
      @apply transform-gpu scale-110;

      h3 {
        @apply text-$primary-lighter;
      }
    }
  }

  legend {
    @apply p-4 text-$ink-dark;
  }

  h3 {
    @apply mb-4 text-$secondary-light transition-colors duration-$long delay-$short;
  }
</style>
