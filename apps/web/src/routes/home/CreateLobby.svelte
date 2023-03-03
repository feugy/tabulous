<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  const dispatch = createEventDispatcher()

  function handleClick() {
    dispatch('select')
  }

  function handleKey(event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      handleClick()
    }
  }
</script>

<article role="link" tabindex="0" on:click={handleClick} on:keyup={handleKey}>
  <legend>
    <h3>{$_('actions.create-lobby')}</h3>
    <div>{$_('labels.lobby-description')}</div>
  </legend>
</article>

<style lang="postcss">
  article {
    @apply m-4 cursor-pointer bg-$secondary-darkest transition-all duration-$short;
    grid-template-areas: 'full';

    --corner-cut: 1rem;
    clip-path: polygon(
      0 var(--corner-cut),
      var(--corner-cut) 0,
      100% 0,
      100% calc(100% - var(--corner-cut)),
      calc(100% - var(--corner-cut)) 100%,
      0 100%
    );

    &:hover {
      @apply transform-gpu scale-105;
    }
  }

  legend {
    @apply p-4 text-$ink-dark;
  }

  h3 {
    @apply mb-4 text-$secondary-light;
  }
</style>
