<script>
  import { _ } from 'svelte-intl'
  import { push } from 'svelte-spa-router'
  export let game
</script>

<style type="postcss">
  article {
    @apply inline-flex flex-col p-6 shadow-md cursor-pointer;
    background: theme('backgrounds.primary');
    transition: all theme('transitions.short') ease-in-out;

    &:hover {
      transform: scale(1.05);
    }
  }

  h3 {
    @apply text-xl pb-2;
  }
</style>

<article on:click={() => push(`/game/${game.id}`)}>
  <h3>{game.kind}</h3>
  <span class="created">{$_('{ created, date, short-date }', game)}</span>
  <span class="players">{$_('labels.players-count', game.players)}</span>
</article>
