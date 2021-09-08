<script>
  import { onMount, onDestroy } from 'svelte'
  import { _ } from 'svelte-intl'
  import {
    // FPSViewer,
    GameMenu,
    InvitePlayerDialogue
  } from '../connected-components'
  import {
    ActionMenu,
    CameraSwitch,
    ControlsHelp,
    CursorInfo,
    Discussion,
    MinimizableSection,
    MeshDetails,
    PlayerAvatar,
    Progress,
    RuleViewer
  } from '../components'
  import {
    cameraSaves,
    connected,
    currentCamera,
    currentGame,
    currentPlayer,
    engine,
    initEngine,
    loadGame,
    longInputs,
    meshDetails,
    meshForMenu,
    restoreCamera,
    saveCamera,
    sendToThread,
    stackSize,
    thread
  } from '../stores'

  export let params = {}

  const longTapDelay = 250
  let canvas
  let interaction
  let openInviteDialogue = false
  let loadPromise
  let rightTab
  let rightAsideInitialWidth = '30vw'
  let hasPeers = false
  let discussionDimension = '15%'
  let rightAsideIcons = ['help']

  $: avatars = $connected.length
    ? // current player should go first
      [
        $currentPlayer,
        ...$currentGame?.players.filter(({ id }) => id !== $currentPlayer.id)
      ].map((player, i) => ({
        player,
        controllable: i === 0,
        stream: $connected?.find(({ playerId }) => playerId === player.id)
          ?.stream
      }))
    : $currentGame?.players.length > 1
    ? // multiple player but none connected: remove current
      $currentGame.players
        .filter(({ id }) => id !== $currentPlayer.id)
        .map(player => ({ player }))
    : // single player: no avatars
      []

  $: hasPeers = $currentGame?.players.length > 1

  $: {
    rightAsideIcons = ['help']
    if ($currentGame?.rulesBookPageCount > 1) {
      rightAsideIcons.splice(0, 0, 'auto_stories')
    }
    if (hasPeers) {
      rightAsideIcons.splice(0, 0, 'people_alt')
    }
  }

  onMount(async () => {
    initEngine({ canvas, interaction, longTapDelay })
    loadPromise = loadGame(params.gameId, $engine)
  })

  onDestroy(() => $engine?.dispose())

  function handleResize() {
    $engine?.resize()
  }

  function handleCloseDetails() {
    interaction?.focus()
  }
</script>

<style type="postcss">
  main {
    @apply relative h-full;
  }

  .interaction,
  .overlay,
  canvas {
    @apply absolute w-full h-full top-0 left-0 z-0;
    touch-action: none;
  }

  aside {
    @apply absolute z-10 top-0;

    &.right {
      @apply right-0 bottom-0;
      background-color: theme('backgrounds.page');
    }

    &.left {
      @apply left-0 p-2;
    }

    &.bottom {
      @apply top-auto bottom-0 flex flex-col p-2 gap-2;
    }
  }

  .overlay {
    @apply flex items-center justify-center z-10;
  }

  .right-content {
    @apply flex flex-col h-full items-stretch;
  }

  .peers {
    @apply grid flex-1 gap-2 place-items-center grid-flow-col;
    grid-template-rows: repeat(auto-fit, minmax(150px, 1fr));
  }

  .help {
    @apply h-full;
  }

  article {
    background-color: red;
    min-height: 150px;
  }
</style>

<svelte:head>
  <title>{$_('page-titles.game')}</title>
</svelte:head>

<svelte:window on:resize={handleResize} />

{#await loadPromise}
  <div class="overlay">
    <Progress />
  </div>
{:catch error}
  <div class="overlay">
    {error.message ?? error}
  </div>
{/await}

<aside class="left">
  <GameMenu on:invite-player={() => (openInviteDialogue = true)} />
  <InvitePlayerDialogue
    game={$currentGame}
    open={openInviteDialogue}
    on:close={() => (openInviteDialogue = false)}
  />
</aside>
<aside class="left bottom">
  <CameraSwitch
    {longTapDelay}
    current={$currentCamera}
    saves={$cameraSaves}
    on:longTap={() => longInputs.next()}
    on:restore={({ detail: { index } }) => restoreCamera(index)}
    on:save={({ detail: { index } }) => saveCamera(index)}
  />
</aside>
<main>
  <div
    class="interaction"
    bind:this={interaction}
    on:contextmenu|preventDefault
  >
    <canvas bind:this={canvas} />
    <ActionMenu object={$meshForMenu} />
  </div>
  <CursorInfo size={$stackSize} halos={longInputs} />
  <MeshDetails mesh={$meshDetails} on:close={handleCloseDetails} />
</main>
<aside class="right">
  <MinimizableSection
    placement="right"
    icons={rightAsideIcons}
    minimized={!hasPeers}
    bind:currentTab={rightTab}
    on:resize={() => (rightAsideInitialWidth = null)}
  >
    <div class="right-content">
      {#if rightAsideIcons[rightTab] === 'people_alt'}
        <div
          class="peers"
          style={rightAsideInitialWidth
            ? `min-width: ${rightAsideInitialWidth}`
            : ''}
        >
          {#each avatars as props}<PlayerAvatar {...props} />{/each}
        </div>
        {#if $connected.length || $thread.length}
          <MinimizableSection
            dimension={discussionDimension}
            placement="bottom"
            icon="question_answer"
          >
            <Discussion
              thread={$thread}
              players={$currentGame?.players}
              on:sendMessage={({ detail }) => sendToThread(detail.text)}
            />
          </MinimizableSection>
        {/if}
      {:else if rightAsideIcons[rightTab] === 'auto_stories'}
        <div
          class="help"
          style={rightAsideInitialWidth
            ? `max-width: ${rightAsideInitialWidth}`
            : ''}
        >
          <RuleViewer
            game={$currentGame?.kind}
            lastPage={$currentGame?.rulesBookPageCount - 1}
          />
        </div>
      {:else}
        <div
          class="help"
          style={rightAsideInitialWidth
            ? `max-width: ${rightAsideInitialWidth}`
            : ''}
        >
          <ControlsHelp />
        </div>
      {/if}
    </div>
  </MinimizableSection>
</aside>
