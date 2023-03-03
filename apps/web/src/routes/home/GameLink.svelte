<script>
  import { Button } from '@src/components'
  import { isLobby } from '@src/utils'
  import { createEventDispatcher } from 'svelte'
  import { _, locale } from 'svelte-intl'

  export let game
  export let playerId
  export let isCurrent = false

  const dispatch = createEventDispatcher()
  const owned = game.players.find(player => player?.isOwner)?.id === playerId
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

  function handleKey(event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      handleClick()
    }
  }
</script>

<article
  class:lobby={isALobby}
  class:isCurrent
  role="link"
  tabindex="0"
  on:click={handleClick}
  on:keyup={handleKey}
>
  <span class="title">
    <h3>{title}</h3>
    <div class="buttons">
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
    @apply inline-flex flex-col p-4 m-2 cursor-pointer bg-$base-light;
    transition: background-color var(--long), color var(--medium) var(--short),
      transform var(--short);

    --corner-cut: 1rem;
    clip-path: polygon(
      0 var(--corner-cut),
      var(--corner-cut) 0,
      100% 0,
      100% calc(100% - var(--corner-cut)),
      calc(100% - var(--corner-cut)) 100%,
      0 100%
    );

    &:not(.isCurrent) .buttons {
      @apply invisible;
    }

    &:hover {
      @apply transform-gpu scale-105 bg-$base-darker text-$ink-dark;

      .buttons {
        @apply visible;
      }

      .guests {
        @apply text-$primary-lighter;
      }
    }

    &.lobby {
      @apply bg-$secondary-darkest text-$ink-dark;

      .title {
        @apply text-$secondary-light;
      }

      .guests {
        @apply text-$primary-lighter;
      }
    }
  }

  .title {
    @apply inline-flex flex-nowrap gap-4;
  }

  .guests {
    @apply text-$primary-darkest;
    transition: color var(--medium) var(--short);
  }

  h3 {
    @apply text-xl flex-1;
  }
</style>
