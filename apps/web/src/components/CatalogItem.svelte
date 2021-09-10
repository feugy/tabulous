<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  export let game

  const dispatch = createEventDispatcher()
</script>

<style type="postcss">
  article {
    @apply inline-grid h-64 shadow-md cursor-pointer flex-1 rounded overflow-hidden;
    grid-template-areas: 'full';
    background: theme('backgrounds.primary');
    transition: all theme('transitions.short') ease-in-out;

    &:hover {
      transform: scale(1.05);
    }
  }

  img {
    @apply max-h-full place-self-center;
    grid-area: full;
  }

  .content {
    @apply flex items-end;
    grid-area: full;
  }

  caption {
    @apply flex flex-col flex-nowrap w-full gap-4 p-4 opacity-80 items-center;
    background: theme('colors.primary.main');
    color: theme('colors.primary.text');
  }

  h3 {
    @apply text-xl flex-1;
  }

  .characteristics {
    @apply flex w-full justify-around;
  }
</style>

<article on:click={() => dispatch('click', game)}>
  <img src="/images/catalog/{game.name}.png" alt={$_(`games.${game.name}`)} />
  <div class="content">
    <caption>
      <h3>{$_(`games.${game.name}`)}</h3>
      <span class="characteristics">
        {#if game.minTime}<span>{$_('labels.game-min-time', game)}</span>{/if}
        {#if game.minAge}<span>{$_('labels.game-min-age', game)}</span>{/if}
      </span>
    </caption>
  </div>
</article>
