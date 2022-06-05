<script>
  import ControlsHelp from './ControlsHelp/ControlsHelp.svelte'
  import Discussion from './Discussion.svelte'
  import MinimizableSection from './MinimizableSection.svelte'
  import PlayerAvatar from './PlayerAvatar.svelte'
  import RuleViewer from './RuleViewer.svelte'

  export let player
  export let localDevices
  export let playerById
  export let thread
  export let connected
  export let game = undefined

  const helpId = 'help'
  const playersId = 'players'
  const rulesId = 'rules'

  let tab
  let initialWidth = '30vw'
  let hasPeers = false
  let discussionDimension = '15%'
  let tabs = [{ icon: 'help', id: helpId, key: 'F1' }]

  $: otherPlayers = [...(playerById?.values() ?? [])].filter(
    ({ id }) => id !== player.id
  )

  $: hasPeers = playerById?.size > 1

  $: hasConnectedPeers = otherPlayers.some(({ playing }) => playing)

  $: avatars = connected?.length
    ? // current player should go first
      [
        {
          player: playerById?.get(player.id),
          controllable: true,
          ...localDevices
        },
        ...otherPlayers.map(player => ({
          player,
          stream: connected?.find(({ playerId }) => playerId === player.id)
            ?.stream
        }))
      ]
    : hasPeers
    ? // multiple player but none connected: remove current
      otherPlayers.map(player => ({ player }))
    : // single player: no avatars
      []

  $: {
    tabs = [{ icon: 'help', id: helpId, key: 'F1' }]
    if (game?.rulesBookPageCount > 1) {
      tabs.splice(0, 0, { icon: 'auto_stories', id: rulesId, key: 'F2' })
    }
    if (hasPeers) {
      tabs.splice(0, 0, { icon: 'people_alt', id: playersId, key: 'F3' })
    }
  }
</script>

<style lang="postcss">
  aside {
    @apply absolute z-10 top-0 right-0 bottom-0 bg-$base-lightest;
  }

  .content {
    @apply flex flex-col h-full items-stretch;
  }

  .peers {
    @apply grid flex-1 gap-2 place-items-center grid-flow-col;
    grid-template-rows: repeat(auto-fit, minmax(150px, 1fr));
  }
</style>

<aside>
  <MinimizableSection
    placement="right"
    {tabs}
    minimized={!hasConnectedPeers}
    bind:currentTab={tab}
    on:resize={() => (initialWidth = 'auto')}
  >
    <div
      class="content"
      style="{tabs[tab]?.id === playersId
        ? 'width'
        : 'max-width'}: {initialWidth}"
    >
      {#if tabs[tab]?.id === playersId}
        <div class="peers">
          {#each avatars as props}<PlayerAvatar {...props} on:select />{/each}
        </div>
        {#if connected?.length || thread?.length}
          <MinimizableSection
            dimension={discussionDimension}
            placement="bottom"
            tabs={[{ icon: 'question_answer', key: 'F4' }]}
          >
            <Discussion {thread} {playerById} on:sendMessage />
          </MinimizableSection>
        {/if}
      {:else if tabs[tab]?.id === rulesId}
        <RuleViewer game={game?.kind} lastPage={game?.rulesBookPageCount - 1} />
      {:else}
        <ControlsHelp />
      {/if}
    </div>
  </MinimizableSection>
</aside>
