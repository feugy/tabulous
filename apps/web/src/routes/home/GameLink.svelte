<script>
  import { Button } from '@src/components'
  import { createEventDispatcher } from 'svelte'
  import { _, locale } from 'svelte-intl'

  import { goto } from '$app/navigation'

  export let game
  export let playerId

  const dispatch = createEventDispatcher()
  const owned = game.players[0]?.id === playerId
  $: peerNames = extractNames(game.players)
  $: guestNames = extractNames(game.guests)

  function extractNames(array) {
    return array
      .filter(player => player && player.id !== playerId)
      .map(({ username }) => username)
  }

  function handleDelete(event) {
    dispatch('delete', game)
    event.stopPropagation()
  }

  function handleClick() {
    goto(`/game/${game.id}`)
  }

  function handleKey(event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      handleClick()
    }
  }
</script>

<article role="link" tabindex="0" on:click={handleClick} on:keyup={handleKey}>
  <span class="title">
    <h3>{game?.locales?.[$locale]?.title}</h3>
    {#if owned}<Button
        secondary
        icon="delete"
        on:click={handleDelete}
        on:keyup={event => event.stopPropagation()}
      />{/if}
  </span>
  <span class="created">{$_('{ created, date, short-date }', game)}</span>
  {#if peerNames.length}
    <span>{$_('labels.peer-players', { names: peerNames.join(', ') })}</span>
  {/if}
  {#if guestNames.length}
    <span class="guests"
      >{$_('labels.peer-guests', { names: guestNames.join(', ') })}</span
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

  .guests {
    @apply text-$primary;
  }

  h3 {
    @apply text-xl flex-1;
  }
</style>
