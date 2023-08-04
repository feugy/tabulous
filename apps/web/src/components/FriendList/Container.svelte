<script>
  // @ts-check
  /**
   * @typedef {import('@src/graphql').GameOrGameParameters} GameOrGameParameters
   * @typedef {import('@src/graphql').PlayerFragment} PlayerFragment
   * @typedef {import('@src/graphql').LightPlayer} LightPlayer
   * @typedef {import('@src/graphql').PlayerWithSearchable} Player
   * @typedef {import('@src/graphql').Friendship} Friendship
   */

  import { requestFriendship, searchPlayers } from '@src/stores'
  import { isLobby } from '@src/utils'
  import { debounceTime, map, Subject, switchMap } from 'rxjs'
  import { onMount } from 'svelte'
  import { _ } from 'svelte-intl'

  import { Button, Typeahead, UsernameSearchability } from '..'
  import FriendList from './FriendList.svelte'
  import InviteDialogue from './InviteDialogue.svelte'
  import PlayerList from './PlayerList.svelte'

  /** @type {Player} authenticated player. */
  export let user
  /** @type {?GameOrGameParameters} game data. */
  export let game = null
  /** @type {?Map<string, LightPlayer>} map of game/lobby players by their ids. */
  export let playerById = null
  /** @type {Friendship[]} list of all friendships. */
  export let friends = []

  /** @type {?HTMLInputElement} */
  let inputRef
  /** @type {(PlayerFragment & { label:string })[]} list of search result candidate players. */
  let candidates = []
  /** @type {?PlayerFragment & { label:string }} selected player in candidate list. */
  let futureFriend = null
  /** @type {{ player: LightPlayer, isNotFriend: boolean }[]} players of the current game/loby if any. */
  let players = []
  /** @type {Friendship[]} list of friendships that are not active players. */
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
        if (player.id !== user.id) {
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

  async function findCandidates(/** @type {Event} */ { target }) {
    const text = /** @type {?HTMLInputElement} */ (target)?.value ?? ''
    if (text.length >= 2) {
      search.next(text)
    } else {
      candidates = []
      futureFriend = null
    }
  }

  function handleMakeFriendRequest(
    /** @type {CustomEvent<?PlayerFragment>|MouseEvent} */ event
  ) {
    if (typeof event.detail === 'object' && event.detail?.id) {
      futureFriend = { ...event.detail, label: '' }
    }
    if (futureFriend) {
      requestFriendship(futureFriend)
      candidates = []
      futureFriend = null
    }
  }
</script>

{#if game}
  <section aria-roledescription="player-list">
    <h3>{$_(isLobby(game) ? 'titles.attendee-list' : 'titles.player-list')}</h3>
    <PlayerList {players} {game} on:makeFriend={handleMakeFriendRequest} />
    {#if (game.availableSeats ?? 0) > 0}
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
    <UsernameSearchability searchable={user.usernameSearchable} />
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
