<script>
  import { createEventDispatcher } from 'svelte'
  import { _, locale } from 'svelte-intl'

  export let game

  $: title = game?.locales?.[$locale]?.title

  const dispatch = createEventDispatcher()
</script>

<style lang="postcss">
  article {
    @apply inline-grid h-64 shadow-md cursor-pointer flex-1 rounded 
           overflow-hidden bg-$base-lighter transition-all duration-$short;
    grid-template-areas: 'full';

    &:hover {
      @apply transform-gpu scale-105;
    }
  }

  img {
    @apply max-h-full place-self-center overflow-hidden;
    grid-area: full;
  }

  .content {
    @apply flex items-end;
    grid-area: full;
  }

  caption {
    @apply flex flex-col flex-nowrap w-full gap-4 p-4 
           opacity-80 items-center bg-$primary text-$primary-lightest;
  }

  h3 {
    @apply text-xl flex-1;
  }

  .characteristics {
    @apply flex w-full justify-around;
  }
</style>

<article on:click={() => dispatch('click', game)}>
  <img src="games/{game.name}/catalog/cover.png" alt={title} />
  <div class="content">
    <caption>
      <h3>{title}</h3>
      <span class="characteristics">
        {#if game.minTime}<span>{$_('labels.game-min-time', game)}</span>{/if}
        {#if game.minAge}<span>{$_('labels.game-min-age', game)}</span>{/if}
      </span>
    </caption>
  </div>
</article>
