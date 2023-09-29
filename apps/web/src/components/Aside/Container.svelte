<script>
  // @ts-check
  import { isLobby as checkIfLobby } from '@src/utils'
  import { beforeUpdate } from 'svelte'
  import { _ } from 'svelte-intl'

  import { ControlsHelp, FriendList, MinimizableSection, RuleViewer } from '..'
  import AvatarGrid from './AvatarGrid.svelte'
  import VideoCommands from './VideoCommands.svelte'

  /** @type {import('@src/graphql').PlayerWithSearchable} authenticated player. */
  export let user
  /** @type {Map<string, import('@src/stores').PlayerWithPref>} map of game/lobby players by their ids. */
  export let playerById
  /** @type {import('@src/stores').Connected[]} currently connected active players. */
  export let connected
  /** @type {import('@babylonjs/core').Engine['actionNamesByButton']} engine action names by mouse button. */
  export let actionNamesByButton = new Map()
  /** @type {import('@babylonjs/core').Engine['actionNamesByKey']} engine action names by hotkeys. */
  export let actionNamesByKey = new Map()
  /** @type {?import('@src/graphql').GameOrGameParameters} game data */
  export let game = null
  /** @type {import('@src/graphql').Game['messages']} list of messages. */
  export let thread = undefined
  /** @type {import('@src/graphql').Game['history']} action history. */
  export let history = undefined
  /** @type {number} rank in the game history. */
  export let replayRank = 0
  /** @type {import('@src/graphql').Friendship[]} list of all friendships. */
  export let friends = []

  const helpId = 'help'
  const playersId = 'players'
  const rulesId = 'rules'
  const friendsId = 'friends'

  /** @type {number} currently expanded tab. */
  let tab
  /** @type {import('@src/components').SectionTab[]} */
  let tabs = []
  let hasPeers = false
  let previousConnectedLength = 0

  $: isLobby = checkIfLobby(game)

  $: hasPeers = playerById?.size > 1

  $: hasInvites = friends?.some(({ isRequest }) => isRequest)

  $: {
    // computes new tabs based onreceived game and peers
    const newTabs = [{ icon: 'people_alt', id: friendsId, key: 'F2' }]
    if (game) {
      if ((game.availableSeats ?? 0) === 0 && playerById.size === 1) {
        newTabs.splice(0, 1)
      }
      if (!isLobby) {
        newTabs.push({ icon: 'help', id: helpId, key: 'F1' })
        if ((game.rulesBookPageCount ?? 0) > 1) {
          newTabs.splice(0, 0, { icon: 'auto_stories', id: rulesId, key: 'F3' })
        }
      }
      if (hasPeers) {
        newTabs.splice(0, 0, { icon: 'contacts', id: playersId, key: 'F4' })
      }
    }
    if (makeTabsKey(newTabs) !== makeTabsKey(tabs)) {
      tabs = newTabs
      tab = isLobby ? newTabs.length - 1 : 0
    }
  }

  beforeUpdate(() => {
    // when someone connects, automatically displays videos,
    if (connected?.length > previousConnectedLength) {
      tab = 0
    }
    previousConnectedLength = connected?.length ?? 0
  })

  function handleSetTab(
    /** @type {CustomEvent<{ currentTab: number }>} */ {
      detail: { currentTab }
    }
  ) {
    // do nor use `bind:currentTab={tab}` because it computes tabs again, which reset current tab
    tab = currentTab
  }

  function makeTabsKey(
    /** @type {import('@src/components').SectionTab[]} */ tabs
  ) {
    return tabs.map(({ id }) => id).join('-')
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
          {history}
          {replayRank}
          {playerById}
          {game}
          {user}
          on:sendMessage
          on:replay
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
