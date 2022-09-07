<script>
  import { goto } from '$app/navigation'
  import { createEventDispatcher } from 'svelte'
  import { _, locale } from 'svelte-intl'
  import Button from './Button.svelte'

  export let game
  export let playerId

  const dispatch = createEventDispatcher()
  const owned = game.players[0]?.id === playerId
  const isSingle = game.players.length === 1
  const peerNames = game.players
    .filter(player => player && player.id !== playerId)
    .map(({ username }) => username)

  function handleDelete(event) {
    dispatch('delete', game)
    event.stopPropagation()
  }
</script>

<article on:click={() => goto(`/game/${game.id}`)}>
  <span class="title">
    <h3>{game?.locales?.[$locale]?.title}</h3>
    {#if owned}<Button secondary icon="delete" on:click={handleDelete} />{/if}
  </span>
  <span class="created">{$_('{ created, date, short-date }', game)}</span>
  {#if !isSingle}
    <span class="players"
      >{$_('labels.peer-players', { names: peerNames.join(', ') })}</span
    >
  {/if}
</article>

<style lang="postcss">
  article {
    @apply inline-flex flex-col p-6 rounded shadow-md cursor-pointer 
           bg-$base-lighter transition duration-$short;

    &:hover {
      @apply transform-gpu scale-105;
    }
  }

  .title {
    @apply inline-flex flex-nowrap items-center gap-4 mb-2;
  }

  h3 {
    @apply text-xl flex-1;
  }
</style>
