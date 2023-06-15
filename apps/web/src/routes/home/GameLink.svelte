<script>
  import { Button } from '@src/components'
  import { gameAssetsUrl, isLobby } from '@src/utils'
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
  $: coverImage = game ? `${gameAssetsUrl}/${game.kind}/catalog/cover.webp` : ''

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
</script>

<article
  class:lobby={isALobby}
  class:isCurrent
  style:--bg-url="url('{coverImage}')"
>
  <button tabindex={0} on:click={handleClick}>
    <span class="title">
      <h3>{title}</h3>
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
  </button>
  <div class="actions">
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
</article>

<style lang="postcss">
  article {
    @apply relative inline-flex flex p-4 m-2 bg-$base-lighter rounded;
    transition: background-color var(--long), color var(--medium),
      transform var(--short);

    &::before {
      @apply absolute inset-0 w-full h-full;
      content: '';
      background-image: var(--bg-url);
      background-size: cover;
      filter: grayscale(100%) opacity(15%);
    }

    &:not(.isCurrent) .actions {
      @apply invisible;
    }

    &:hover {
      @apply transform-gpu scale-110 bg-$base-darker text-$ink-dark;

      h3 {
        @apply text-$primary-lighter;
        transition: color var(--long) var(--short);
      }

      .actions {
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

  button {
    @apply flex flex-col flex-1 text-left;
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
