<script>
  import { requestFriendship, searchPlayers } from '@src/stores'
  import { isLobby } from '@src/utils'
import { debounceTime, map, Subject, switchMap } from 'rxjs'
  import { onMount } from 'svelte'
  import { _ } from 'svelte-intl'

  import { Button, Typeahead, UsernameSearchability } from '..'
  import FriendList from './FriendList.svelte'
  import InviteDialogue from './InviteDialogue.svelte'
  import PlayerList from './PlayerList.svelte'

  export let game = null
  export let currentPlayer = null
  export let playerById = null
  export let friends = []

  let inputRef
  let candidates
  let futureFriend
  let players = []
  let friendships = []
  let openInviteDialogue = false
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
        if (player.id !== currentPlayer.id) {
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

  function handleMakeFriendRequest({ detail: player } = {}) {
    if (player?.id) {
      futureFriend = player
    }
    if (futureFriend) {
      requestFriendship(futureFriend)
      candidates = undefined
      futureFriend = undefined
    }
  }
</script>

{#if game}
  <section aria-roledescription="player-list">
    <h3>{$_(isLobby(game) ? 'titles.attendee-list' : 'titles.player-list')}</h3>
    <PlayerList {players} {game} on:makeFriend={handleMakeFriendRequest} />
    {#if game.availableSeats > 0}
      <div>
        <Button
          icon="gamepad"
          text={$_(
            isLobby(game) ? 'actions.invite-attendee' : 'actions.invite-player'
          )}
          on:click={() => (openInviteDialogue = true)}
        />
      </div>
      <InviteDialogue
        open={openInviteDialogue}
        {game}
        friends={friendships}
        on:close={() => (openInviteDialogue = false)}
      />
    {/if}
  </section>
{:else}
  <section aria-roledescription="friend-list">
    <h3>{$_('titles.friend-list')}</h3>
    <UsernameSearchability searchable={currentPlayer.usernameSearchable} />
    <FriendList friends={friendships} />
    <div>
      <Typeahead
        placeholder={$_('placeholders.invitee-username')}
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
    {#if !friendships?.length}
      <span class:empty={true}>{$_('labels.empty-friend-list')}</span>
    {/if}
  </section>
{/if}

<style lang="postcss">
  section {
    @apply flex flex-col p-6 overflow-hidden;
  }

  h3 {
    @apply text-xl font-bold;
  }

  div {
    @apply my-2 flex gap-4 items-center justify-center;
  }

  .empty {
    @apply inline-block self-center py-8;
  }
</style>
