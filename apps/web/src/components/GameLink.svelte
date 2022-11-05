<script>
  import { createEventDispatcher } from 'svelte'
  import { _, locale } from 'svelte-intl'

  import { goto } from '$app/navigation'

  import Button from './Button.svelte'

  export let game
  export let playerId

  const dispatch = createEventDispatcher()
  const owned = game.players[0]?.id === playerId
  $: isSingle = game.players.length === 1
  $: peerNames = game.players
    .filter(player => player && player.id !== playerId)
    .map(({ username }) => username)

  function handleDelete(event) {
    dispatch('delete', game)
    event.stopPropagation()
  }

  function handleClick() {
    goto(`/game/${game.id}`)
  }

  function handleKeydown(event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      handleClick()
    }
  }
</script>

<article
  role="link"
  tabindex="0"
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  <span class="title">
    <h3>{game?.locales?.[$locale]?.title}</h3>
    {#if owned}<Button
        secondary
        icon="delete"
        on:click={handleDelete}
        on:keydown={event => event.stopPropagation()}
      />{/if}
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
