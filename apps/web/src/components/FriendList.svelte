<script>
  import {
    acceptFriendship,
    endFriendship,
    requestFriendship,
    searchPlayers
  } from '@src/stores'
import { debounceTime, map, Subject, switchMap } from 'rxjs'
  import { onMount } from 'svelte'
  import { _ } from 'svelte-intl'

  import Button from './Button.svelte'
  import ConfirmDialogue from './ConfirmDialogue.svelte'
  import PlayerThumbnail from './PlayerThumbnail.svelte'
  import Typeahead from './Typeahead.svelte'

  export let friends = []

  let inputRef
  let candidates
  let futureFriend
  let friendToRemove
  let search = new Subject()

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

  function handleMakeRequest() {
    if (futureFriend) {
      requestFriendship(futureFriend)
      futureFriend = null
    }
  }

  function handleEndingFriendship({ detail: isConfirmed }) {
    if (isConfirmed) {
      endFriendship(friendToRemove)
    }
    friendToRemove = null
  }
</script>

<section>
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
      on:click={handleMakeRequest}
    />
  </div>
  {#if !friends?.length}
    <span class:empty={true}>{$_('labels.empty-friend-list')}</span>
  {/if}
  <ol>
    {#each friends as { player, isRequest, isProposal } (player.id)}
      <li class:isRequest class:isProposal>
        <PlayerThumbnail {player} />
        <span
          >{isProposal
            ? $_('labels.friendship-proposed', player)
            : isRequest
            ? $_('labels.friendship-requested', player)
            : player.username}</span
        >
        <span class="buttons">
          {#if isRequest}
            <Button icon="check" on:click={() => acceptFriendship(player)} />
            <Button icon="clear" on:click={() => endFriendship(player)} />
          {:else}
            <Button icon="delete" on:click={() => (friendToRemove = player)} />
          {/if}
        </span>
      </li>
    {/each}
  </ol>
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
    @apply flex flex-col p-8;
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
    @apply mt-8 flex-1 divide-y;
  }

  li {
    @apply flex items-center p-2 pr-4 gap-2 transition-all relative duration-500;

    &:hover {
      @apply bg-$primary-lighter;
      & .buttons {
        @apply opacity-100;
      }
    }

    &.isRequest,
    &.isProposal {
      @apply text-$primary-light;
    }
  }

  .buttons {
    @apply flex flex-nowrap gap-2 justify-self-end opacity-0 absolute right-4 transition-opacity duration-500;
  }
</style>
