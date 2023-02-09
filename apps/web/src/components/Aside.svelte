<script>
  import { isLobby } from '@src/utils'
  import { _ } from 'svelte-intl'

  import ControlsHelp from './ControlsHelp/index.js'
  import Discussion from './Discussion.svelte'
  import FriendList from './FriendList.svelte'
  import MinimizableSection from './MinimizableSection.svelte'
  import PlayerAvatar from './PlayerAvatar.svelte'
  import RuleViewer from './RuleViewer.svelte'

  export let player
  export let playerById
  export let thread
  export let connected
  export let game = undefined
  export let friends = undefined

  const helpId = 'help'
  const playersId = 'players'
  const rulesId = 'rules'
  const friendsId = 'friends'

  let tab
  let tabs
  let initialWidth = '30vw'
  let hasPeers = false
  let discussionDimension = '15%'

  $: otherPlayers = [...(playerById?.values() ?? [])].filter(
    ({ id }) => id !== player.id
  )

  $: hasPeers = playerById?.size > 1

  $: hasInvites = friends?.some(({ isRequest }) => isRequest)

  $: peers = hasPeers
    ? otherPlayers.map(player => ({
        player,
        ...(connected?.find(({ playerId }) => playerId === player.id) ?? {})
      }))
    : []

  $: {
    tabs = [{ icon: 'people_alt', id: friendsId, key: 'F2' }]
    if (isLobby(game)) {
      tabs.splice(0, 0, { icon: 'contacts', id: playersId, key: 'F4' })
    } else if (game) {
      tabs.push({ icon: 'help', id: helpId, key: 'F1' })
      if (game?.rulesBookPageCount > 1) {
        tabs.splice(0, 0, { icon: 'auto_stories', id: rulesId, key: 'F3' })
      }
      if (hasPeers) {
        tabs.splice(0, 0, { icon: 'contacts', id: playersId, key: 'F4' })
      }
    }
  }
</script>

<aside>
  <MinimizableSection
    placement="right"
    {tabs}
    minimized={!hasPeers && !hasInvites}
    bind:currentTab={tab}
    on:resize={() => (initialWidth = 'auto')}
  >
    <div
      class="content"
      style="{tabs[tab]?.id === playersId
        ? 'width'
        : 'max-width'}: {initialWidth}"
    >
      <div class="peers" class:hidden={tabs[tab]?.id !== playersId}>
        <span class="avatars">
          {#if connected?.length}
            <PlayerAvatar player={playerById.get(player.id)} isLocal={true} />
          {/if}
          {#each peers as { playerId, ...props } (props.player.id)}
            <PlayerAvatar {...props} />
          {/each}
        </span>
        {#if isLobby(game)}
          <div class="lobby-instructions">
            {$_('labels.lobby-instructions')}
          </div>
        {/if}
        {#if tabs[tab]?.id === playersId}
          <MinimizableSection
            dimension={discussionDimension}
            placement="bottom"
            tabs={[{ icon: 'question_answer', key: 'F5' }]}
          >
            <Discussion {thread} {playerById} on:sendMessage />
          </MinimizableSection>
        {/if}
      </div>
      {#if tabs[tab]?.id === rulesId}
        <RuleViewer game={game?.kind} lastPage={game?.rulesBookPageCount - 1} />
      {:else if tabs[tab]?.id === helpId}
        <ControlsHelp />
      {:else if tabs[tab]?.id === friendsId}
        <FriendList {friends} />
      {/if}
    </div>
  </MinimizableSection>
</aside>

<style lang="postcss">
  aside {
    @apply bg-$base-lightest z-10;
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
  .avatars {
    @apply flex-1 grid place-items-center grid-flow-col;
    grid-template-rows: repeat(auto-fit, minmax(150px, 1fr));
  }
</style>
