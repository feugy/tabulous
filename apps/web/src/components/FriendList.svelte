<script>
  import {
    acceptFriendship,
    endFriendship,
    invite,
    requestFriendship,
    searchPlayers
  } from '@src/stores'
  import { isLobby } from '@src/utils'
  import { debounceTime, map, Subject, switchMap } from 'rxjs'
  import { onMount } from 'svelte'
  import { _ } from 'svelte-intl'

  import Button from './Button.svelte'
  import ConfirmDialogue from './ConfirmDialogue.svelte'
  import PlayerThumbnail from './PlayerThumbnail.svelte'
  import Typeahead from './Typeahead.svelte'

  export let game = null
  export let currentPlayerId = null
  export let playerById = null
  export let friends = []

  let inputRef
  let candidates
  let futureFriend
  let friendToRemove
  let players = []
  let friendships = []
  let selected = []
  let search = new Subject()

  $: {
    players = []
    friendships = friends
    if (playerById?.size) {
      const friendIds = new Set()
      friendships = []
      for (const friendship of friends) {
        const { id } = friendship.player
        friendIds.add(id)
        if (!playerById.has(id)) {
          friendships.push(friendship)
        }
      }
      for (const player of playerById.values()) {
        if (player.id !== currentPlayerId) {
          players.push({ player, isNotFriend: !friendIds.has(player.id) })
        }
      }
    }
  }

  onMount(() =>
    search
      .pipe(
        debounceTime(100),
        switchMap(search => searchPlayers(search)),
        map(players =>
          players
            .filter(player =>
              friends.every(({ player: { id } }) => id !== player.id)
            )
            .map(player => ({ ...player, label: player.username }))
        )
      )
      .subscribe({ next: results => (candidates = results) })
  )

  async function findCandidates({ target }) {
    const text = target?.value ?? ''
    if (text.length >= 2) {
      search.next(text)
    } else {
      candidates = undefined
      futureFriend = undefined
    }
  }

  function isInteractive({ isRequest }) {
    return Boolean(game) && !isRequest
  }

  function handleMakeFriendRequest() {
    if (futureFriend) {
      requestFriendship(futureFriend)
      candidates = undefined
      futureFriend = undefined
    }
  }

  function handleEndingFriendship({ detail: isConfirmed }) {
    if (isConfirmed) {
      endFriendship(friendToRemove)
    }
    friendToRemove = null
  }

  function handleToggle(player) {
    const index = selected.indexOf(player)
    if (index >= 0) {
      selected = [...selected.slice(0, index), ...selected.slice(index + 1)]
    } else {
      selected = [...selected, player]
    }
  }

  function handleKeyDown(evt, player) {
    if (evt.key === 'Enter' || evt.key === ' ') {
      handleToggle(player)
    }
  }

  function handleInvite() {
    invite(game.id, ...selected.map(({ id }) => id))
    selected = []
  }
</script>

{#if players.length}
  <section aria-roledescription="player-list">
    <h3>{$_(isLobby(game) ? 'titles.attendee-list' : 'titles.player-list')}</h3>
    <ol>
      {#each players as { player, isNotFriend } (player.id)}
        <li class="isPlayer" class:isNotFriend>
          <PlayerThumbnail {player} dimension={40} />
          <span role="term">{player.username}</span>
          {#if isNotFriend}
            <span class="buttons">
              <Button
                icon="person_add_alt_1"
                on:click={() => {
                  futureFriend = player
                  handleMakeFriendRequest()
                }}
              />
            </span>
          {/if}
        </li>
      {/each}
    </ol>
  </section>
{/if}
<section aria-roledescription="friend-list">
  <h3>{$_('titles.friend-list')}</h3>
  <div>
    <Typeahead
      placeholder={$_('placeholders.username')}
      options={candidates}
      bind:value={futureFriend}
      bind:ref={inputRef}
      on:input={findCandidates}
      on:select={() => inputRef?.focus()}
    />
    <Button
      icon="person_add_alt_1"
      disabled={!futureFriend}
      on:click={handleMakeFriendRequest}
    />
  </div>
  {#if !friends?.length}
    <span class:empty={true}>{$_('labels.empty-friend-list')}</span>
  {/if}
  <ol role="listbox">
    {#each friendships as { player, isRequest, isProposal } (player.id)}
      {@const interactive = isInteractive({ isRequest })}
      <li
        class:isRequest
        class:isProposal
        role="option"
        aria-checked={selected.indexOf(player) >= 0}
        aria-selected={interactive}
        tabindex={interactive ? 0 : -1}
        on:click={interactive ? () => handleToggle(player) : null}
        on:keydown={interactive ? evt => handleKeyDown(evt, player) : null}
      >
        <PlayerThumbnail {player} dimension={40} />
        <span role="term"
          >{isProposal
            ? $_('labels.friendship-proposed', player)
            : isRequest
            ? $_('labels.friendship-requested', player)
            : player.username}</span
        >
        <span class="buttons">
          {#if isRequest}
            <Button
              icon="check"
              primary
              on:click={() => acceptFriendship(player)}
            />
            <Button icon="clear" on:click={() => endFriendship(player)} />
          {:else}
            <Button icon="delete" on:click={() => (friendToRemove = player)} />
          {/if}
        </span>
      </li>
    {/each}
  </ol>
  {#if selected.length}
    <span class="invite">
      <Button
        text={$_(
          isLobby(game) ? 'actions.invite-attendee' : 'actions.invite-player'
        )}
        icon="gamepad"
        on:click={handleInvite}
      />
    </span>
  {/if}
  {#if friendToRemove}
    <ConfirmDialogue
      title={$_('titles.end-friendship')}
      open={true}
      message={$_('labels.end-friendship', friendToRemove)}
      on:close={handleEndingFriendship}
    />
  {/if}
</section>

<style lang="postcss">
  section {
    @apply flex flex-col m-8 overflow-hidden;
  }

  section + section {
    @apply mt-0;
  }

  h3 {
    @apply text-xl font-bold;
  }

  div {
    @apply flex gap-4 items-center;
  }

  .empty {
    @apply inline-block self-center py-8;
  }

  ol {
    @apply mt-8 flex-1 divide-y overflow-auto;
  }

  li {
    @apply flex items-center p-2 pr-4 gap-2 border-$base-dark relative duration-500;
    transition: background-color;
    margin: 1px; /* without, outline is not visible */

    &:hover,
    &:hover.isProposal,
    &:hover.isRequest {
      @apply text-$ink-dark bg-$primary-darker;
      & .buttons {
        @apply opacity-100;
      }
    }

    &[role='option'] {
      @apply cursor-pointer;
    }

    &.isNotFriend {
      @apply text-$base-dark;
    }

    &.isRequest,
    &.isProposal {
      @apply text-$primary-darkest;
    }
    &[aria-checked='true'] {
      @apply bg-$primary-light text-$base-lightest;
    }
  }

  .buttons {
    @apply flex flex-nowrap gap-2 justify-self-end opacity-0 absolute right-4 transition-opacity duration-500;
  }

  .invite {
    @apply pt-4 text-center;
  }
</style>
