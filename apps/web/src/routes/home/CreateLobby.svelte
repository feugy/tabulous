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
  <div class="content">
    <legend>
      <div class="title">
        <h3>{$_('actions.create-lobby')}</h3>
        <div>{$_('labels.lobby-description')}</div>
      </div>
    </legend>
  </div>
</article>

<style lang="postcss">
  article {
    @apply inline-grid h-64 shadow-md cursor-pointer flex-1 rounded 
           overflow-hidden bg-$base-lighter transition-all duration-$short;
    grid-template-areas: 'full';

    &:hover {
      @apply transform-gpu scale-105;
    }
  }

  .content {
    @apply flex items-end;
    grid-area: full;
  }

  legend {
    @apply flex flex-nowrap w-full gap-4 p-4 
           opacity-80 bg-$primary text-$primary-lightest;
  }

  .title {
    @apply flex-1 text-left;
  }

  h3 {
    @apply text-xl;
  }
</style>
