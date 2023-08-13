<script>
  // @ts-check
  /**
   * @typedef {import('@babylonjs/core').Engine} Engine
   * @typedef {import('@src/components').SectionTab} SectionTab
   * @typedef {import('@src/graphql').Friendship} Friendship
   * @typedef {import('@src/graphql').Game} Game
   * @typedef {import('@src/graphql').GameOrGameParameters} GameOrGameParameters
   * @typedef {import('@src/graphql').PlayerWithSearchable} PlayerWithSearchable
   * @typedef {import('@src/stores').Connected} Connected
   * @typedef {import('@src/stores/game-manager').Player} Player
   */

  import { isLobby as checkIfLobby } from '@src/utils'
  import { _ } from 'svelte-intl'

  import { ControlsHelp, FriendList, MinimizableSection, RuleViewer } from '..'
  import AvatarGrid from './AvatarGrid.svelte'
  import VideoCommands from './VideoCommands.svelte'

  /** @type {PlayerWithSearchable} authenticated player. */
  export let user
  /** @type {Map<string, Player>} map of game/lobby players by their ids. */
  export let playerById
  /** @type {Game['messages']} list of message threads*/
  export let thread
  /** @type {Connected[]} currently connected active players. */
  export let connected
  /** @type {Engine['actionNamesByButton']} engine action names by mouse button. */
  export let actionNamesByButton = new Map()
  /** @type {Engine['actionNamesByKey']} engine action names by hotkeys. */
  export let actionNamesByKey = new Map()
  /** @type {?GameOrGameParameters} game data */
  export let game = null
  /** @type {Friendship[]} list of all friendships. */
  export let friends = []

  const helpId = 'help'
  const playersId = 'players'
  const rulesId = 'rules'
  const friendsId = 'friends'

  /** @type {number} currently expanded tab. */
  let tab
  /** @type {SectionTab[]} */
  let tabs = []
  let hasPeers = false

  $: isLobby = checkIfLobby(game)

  $: hasPeers = playerById?.size > 1

  $: hasInvites = friends?.some(({ isRequest }) => isRequest)

  $: {
    tabs = [{ icon: 'people_alt', id: friendsId, key: 'F2' }]
    if (game) {
      if ((game.availableSeats ?? 0) === 0 && playerById.size === 1) {
        tabs.splice(0, 1)
      }
      if (!isLobby) {
        tabs.push({ icon: 'help', id: helpId, key: 'F1' })
        if ((game.rulesBookPageCount ?? 0) > 1) {
          tabs.splice(0, 0, { icon: 'auto_stories', id: rulesId, key: 'F3' })
        }
      }
      if (hasPeers) {
        tabs.splice(0, 0, { icon: 'contacts', id: playersId, key: 'F4' })
      }
    }
    tab = isLobby ? tabs.length - 1 : 0
  }
  $: if (hasPeers && connected?.length) {
    tab = 0
  }

  function handleSetTab(
    /** @type {CustomEvent<{ currentTab: number }>} */ {
      detail: { currentTab }
    }
  ) {
    // do nor use `bind:currentTab={tab}` because it computes tabs again, which reset cuttent tab
    tab = currentTab
  }
</script>

<aside>
  <MinimizableSection
    placement="right"
    {tabs}
    minimized={!hasPeers && !hasInvites && !isLobby}
    currentTab={tab}
    on:change={handleSetTab}
  >
    <div class="content">
      <div class="peers" class:hidden={tabs[tab]?.id !== playersId}>
        <AvatarGrid {connected} {playerById} {user} />
        <VideoCommands />
        {#if isLobby}
          <div class="lobby-instructions">
            {$_('labels.lobby-instructions')}
          </div>
        {/if}
      </div>
      {#if tabs[tab]?.id === rulesId}
        <RuleViewer
          game={game?.kind}
          lastPage={(game?.rulesBookPageCount ?? 1) - 1}
        />
      {:else if tabs[tab]?.id === helpId}
        <ControlsHelp {actionNamesByButton} {actionNamesByKey} />
      {:else if tabs[tab]?.id === friendsId}
        <FriendList
          {friends}
          {thread}
          {playerById}
          {game}
          {user}
          on:sendMessage
        />
      {/if}
    </div>
  </MinimizableSection>
</aside>

<style lang="postcss">
  aside {
    @apply bg-$base-lightest pointer-events-auto;
  }

  .content {
    @apply flex flex-col h-full items-stretch;
  }

  .peers {
    @apply flex flex-col flex-1 overflow-auto;

    &.hidden {
      @apply hidden;
    }
  }

  .lobby-instructions {
    @apply italic p-8 pb-12;
  }
</style>
