<script>
  import { Button } from '@src/components'
  import { isGuest, isLobby } from '@src/utils'
  import { createEventDispatcher } from 'svelte'
  import { _, locale } from 'svelte-intl'

  export let game
  export let playerId
  export let isCurrent = false

  const dispatch = createEventDispatcher()
  const owned = game.players.find(player => player?.isOwner)?.id === playerId
  $: isAGuest = isGuest(game, playerId)
  $: isALobby = isLobby(game)
  $: peerNames = game.players
    .filter(player => player && !player.isGuest && player.id !== playerId)
    .map(({ username }) => username)
  $: guestNames = game.players
    .filter(player => player && player.isGuest && player.id !== playerId)
    .map(({ username }) => username)
  $: title = isALobby ? $_('titles.lobby') : game.locales?.[$locale]?.title

  function handleDelete(event) {
    dispatch('delete', game)
    event.stopPropagation()
  }

  function handleClick() {
    dispatch('select', game)
  }

  function handleClose(event) {
    dispatch('close', game)
    event.stopPropagation()
  }

  function handleInvite(event) {
    dispatch('invite', game)
    event.stopPropagation()
  }

  function handleKey(event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      handleClick()
    }
  }
</script>

<article
  class:lobby={isALobby}
  role="link"
  tabindex="0"
  on:click={handleClick}
  on:keyup={handleKey}
>
  <span class="title">
    <h3>{title}</h3>
    <div class="buttons">
      {#if isALobby && !isAGuest}
        <span class="invite">
          <Button
            secondary
            icon="people"
            on:click={handleInvite}
            on:keyup={event => event.stopPropagation()}
          />
        </span>
      {/if}
      {#if isCurrent}<Button
          secondary
          icon="close"
          on:click={handleClose}
          on:keyup={event => event.stopPropagation()}
        />{:else if owned}<Button
          secondary
          icon="delete"
          on:click={handleDelete}
          on:keyup={event => event.stopPropagation()}
        />{/if}
    </div>
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

    &.lobby {
      @apply bg-$secondary-lightest;
    }
  }

  .title {
    @apply inline-flex flex-nowrap items-center gap-4 mb-2;
  }

  .guests {
    @apply text-$primary;
  }

  .invite {
    @apply self-center;
  }

  h3 {
    @apply text-xl flex-1;
  }
</style>
