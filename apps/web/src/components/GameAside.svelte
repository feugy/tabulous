<script>
  import ControlsHelp from './ControlsHelp/ControlsHelp.svelte'
  import Discussion from './Discussion.svelte'
  import MinimizableSection from './MinimizableSection.svelte'
  import PlayerAvatar from './PlayerAvatar.svelte'
  import RuleViewer from './RuleViewer.svelte'

  export let player
  export let game
  export let thread
  export let connected

  let tab
  let initialWidth = '30vw'
  let hasPeers = false
  let discussionDimension = '15%'
  let icons = ['help']

  $: avatars = connected?.length
    ? // current player should go first
      [player, ...game?.players.filter(({ id }) => id !== player.id)].map(
        (peer, i) => ({
          player: peer,
          controllable: i === 0,
          stream: connected?.find(({ playerId }) => playerId === peer.id)
            ?.stream
        })
      )
    : game?.players.length > 1
    ? // multiple player but none connected: remove current
      game.players
        .filter(({ id }) => id !== player.id)
        .map(player => ({ player }))
    : // single player: no avatars
      []

  $: hasPeers = game?.players.length > 1

  $: {
    icons = ['help']
    if (game?.rulesBookPageCount > 1) {
      icons.splice(0, 0, 'auto_stories')
    }
    if (hasPeers) {
      icons.splice(0, 0, 'people_alt')
    }
  }
</script>

<style type="postcss">
  aside {
    @apply absolute z-10 top-0 right-0 bottom-0;
    background-color: theme('backgrounds.page');
  }

  .content {
    @apply flex flex-col h-full items-stretch;
  }

  .peers {
    @apply grid flex-1 gap-2 place-items-center grid-flow-col;
    grid-template-rows: repeat(auto-fit, minmax(150px, 1fr));
  }

  .thread {
    @apply grid;
  }

  .help {
    @apply h-full;
  }
</style>

<aside>
  <MinimizableSection
    placement="right"
    {icons}
    minimized={!hasPeers}
    bind:currentTab={tab}
    on:resize={() => (initialWidth = 'auto')}
  >
    <div
      class="content"
      style="{icons[tab] === 'people_alt'
        ? 'width'
        : 'max-width'}: {initialWidth}"
    >
      {#if icons[tab] === 'people_alt'}
        <div class="peers">
          {#each avatars as props}<PlayerAvatar {...props} />{/each}
        </div>
        {#if connected?.length || thread?.length}
          <MinimizableSection
            dimension={discussionDimension}
            placement="bottom"
            icons={['question_answer']}
          >
            <Discussion {thread} players={game?.players} on:sendMessage />
          </MinimizableSection>
        {/if}
      {:else if icons[tab] === 'auto_stories'}
        <RuleViewer game={game?.kind} lastPage={game?.rulesBookPageCount - 1} />
      {:else}
        <ControlsHelp />
      {/if}
    </div>
  </MinimizableSection>
</aside>
