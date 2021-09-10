<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import { push } from 'svelte-spa-router'
  import Button from './Button.svelte'

  export let game
  export let playerId

  const dispatch = createEventDispatcher()
  const owned = game.players[0]?.id === playerId
  const isSingle = game.players.length === 1
  const peerNames = game.players
    .filter(({ id }) => id !== playerId)
    .map(({ username }) => username)

  function handleDelete(event) {
    dispatch('delete', game)
    event.stopPropagation()
  }
</script>

<style type="postcss">
  article {
    @apply inline-flex flex-col p-6 rounded shadow-md cursor-pointer;
    background: theme('backgrounds.primary');
    transition: all theme('transitions.short') ease-in-out;

    &:hover {
      transform: scale(1.05);
    }
  }

  .title {
    @apply inline-flex flex-nowrap items-center gap-4 mb-2;
  }

  h3 {
    @apply text-xl flex-1;
  }
</style>

<article on:click={() => push(`/game/${game.id}`)}>
  <span class="title">
    <h3>{$_(`games.${game.kind}`)}</h3>
    {#if owned}<Button secondary icon="delete" on:click={handleDelete} />{/if}
  </span>
  <span class="created">{$_('{ created, date, short-date }', game)}</span>
  {#if !isSingle}
    <span class="players"
      >{$_('labels.peer-players', { names: peerNames.join(', ') })}</span
    >
  {/if}
</article>
