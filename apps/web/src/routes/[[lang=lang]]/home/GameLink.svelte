<script>
  // @ts-check
  /** @typedef {import('@src/graphql').LightGame} LightGame */

  import { Button } from '@src/components'
  import { gameAssetsUrl, isLobby } from '@src/utils'
  import { createEventDispatcher } from 'svelte'
  import { _, locale } from 'svelte-intl'

  /** @type {LightGame} displayed game or lobby. */
  export let game
  /** @type {string} authenticated user id to determine ownership. */
  export let playerId
  /** @type {boolean} whether this link points to the curent game/lobby. */
  export let isCurrent = false

  /** @type {import('svelte').EventDispatcher<{ close: LightGame, delete: LightGame, select: LightGame }>}*/
  const dispatch = createEventDispatcher()
  const owned = game.players?.find(player => player?.isOwner)?.id === playerId
  $: isALobby = isLobby(game)
  $: peerNames = game.players
    ?.filter(player => player && !player.isGuest && player.id !== playerId)
    .map(({ username }) => username)
  $: guestNames = game.players
    ?.filter(player => player && player.isGuest && player.id !== playerId)
    .map(({ username }) => username)
  $: title = isALobby
    ? $_('titles.lobby')
    : game?.locales?.[$locale]?.title || game?.locales?.fr?.title
  $: coverImage = game.kind
    ? `${gameAssetsUrl}/${game.kind}/catalog/${$locale}/cover.webp`
    : ''

  function handleDelete(/** @type {MouseEvent} */ event) {
    dispatch('delete', game)
    event.stopPropagation()
  }

  function handleClick() {
    dispatch('select', game)
  }

  function handleClose(/** @type {MouseEvent} */ event) {
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
    {#if peerNames?.length}
      <span>{$_('labels.peer-players', { names: peerNames.join(', ') })}</span>
    {/if}
    {#if guestNames?.length}
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
      />{:else if owned}<Button
        secondary
        icon="delete"
        on:click={handleDelete}
      />{/if}
  </div>
</article>

<style lang="postcss">
  article {
    @apply relative inline-block m-2 flex bg-$base-lighter rounded overflow-hidden;
    transition:
      background-color var(--long),
      color var(--medium),
      transform var(--short),
      box-shadow var(--short);
    box-shadow: 0px 3px 10px var(--shadow-color);

    &::before {
      @apply absolute inset-0 w-full h-full;
      content: '';
      background-image: var(--bg-url);
      background-size: cover;
      filter: grayscale(100%) opacity(15%);
    }

    &::after {
      @apply absolute -inset-1/2 transition-all duration-$long;
      background: var(--card-light);
      content: '';
    }

    &:not(.isCurrent) .actions {
      @apply hidden;
    }

    &:hover {
      @apply bg-$base-darker text-$ink-dark;
      transform: perspective(450px) rotate3d(1, 0, 0, 5deg)
        scale3d(1.05, 1.05, 1.05) translate3d(0, -4px, 0);
      box-shadow: 0px 1rem 10px var(--shadow-color);

      h3 {
        @apply text-$primary-light transition-colors duration-$long delay-$short;
      }

      .actions {
        @apply block;
      }

      .guests {
        @apply text-$secondary-lighter;
      }

      &::after {
        background-position: 0 0;
      }
    }

    &.lobby {
      @apply bg-$secondary-darkest text-$ink-dark;

      .guests {
        @apply text-$secondary-lighter;
      }

      &:hover {
        @apply bg-$base-darkest;
      }
    }
  }

  button {
    @apply relative flex flex-col flex-1 p-4 text-left rounded z-1;
  }

  .actions {
    @apply absolute top-2 right-2 z-1;
  }

  .title {
    @apply inline-flex flex-nowrap gap-4;
  }

  .guests {
    @apply text-$secondary-darker;
    transition: color var(--medium) var(--short);
  }

  h3 {
    @apply text-xl flex-1;
  }
</style>
