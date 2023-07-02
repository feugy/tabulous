<script>
  import { isLobby as checkIfLobby } from '@src/utils'
  import { _ } from 'svelte-intl'

  import ControlsHelp from '../ControlsHelp.svelte'
  import Discussion from '../Discussion.svelte'
  import FriendList from '../FriendList.svelte'
  import MinimizableSection from '../MinimizableSection.svelte'
  import RuleViewer from '../RuleViewer.svelte'
  import AvatarGrid from './AvatarGrid.svelte'
  import VideoCommands from './VideoCommands.svelte'

  export let player
  export let playerById
  export let thread
  export let connected
  export let actionNamesByButton = new Map()
  export let actionNamesByKey = new Map()
  export let game = undefined
  export let friends = undefined

  const helpId = 'help'
  const playersId = 'players'
  const discussionId = 'discussion'
  const rulesId = 'rules'
  const friendsId = 'friends'

  let tab
  let tabs
  let hasPeers = false

  $: isLobby = checkIfLobby(game)

  $: hasPeers = playerById?.size > 1

  $: hasInvites = friends?.some(({ isRequest }) => isRequest)

  $: {
    tabs = [{ icon: 'people_alt', id: friendsId, key: 'F2' }]
    if (game) {
      if (!isLobby) {
        tabs.push({ icon: 'help', id: helpId, key: 'F1' })
        if (game.rulesBookPageCount > 1) {
          tabs.splice(0, 0, { icon: 'auto_stories', id: rulesId, key: 'F3' })
        }
      }
      if (hasPeers) {
        tabs.splice(
          0,
          0,
          { icon: 'contacts', id: playersId, key: 'F4' },
          { icon: 'question_answer', id: discussionId, key: 'F5' }
        )
      }
    }
    tab = isLobby ? tabs.length - 1 : 0
  }

  function handleSetTab({ detail: { currentTab } }) {
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
        <AvatarGrid {connected} {playerById} {player} />
        <VideoCommands />
        {#if isLobby}
          <div class="lobby-instructions">
            {$_('labels.lobby-instructions')}
          </div>
        {/if}
      </div>
      {#if tabs[tab]?.id === discussionId}
        <Discussion {thread} {playerById} on:sendMessage />
      {:else if tabs[tab]?.id === rulesId}
        <RuleViewer game={game?.kind} lastPage={game?.rulesBookPageCount - 1} />
      {:else if tabs[tab]?.id === helpId}
        <ControlsHelp {actionNamesByButton} {actionNamesByKey} />
      {:else if tabs[tab]?.id === friendsId}
        <FriendList
          {friends}
          {playerById}
          {game}
          currentPlayerId={player?.id}
        />
      {/if}
    </div>
  </MinimizableSection>
</aside>

<style lang="postcss">
  aside {
    @apply z-10 bg-$base-lightest;
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
