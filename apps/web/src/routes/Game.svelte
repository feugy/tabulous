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
    Discussion,
    MinimizableSection,
    ObjectDetails,
    PlayerAvatar,
    Progress,
    StackSizeTooltip
  } from '../components'
  import {
    cameraSaves,
    connected,
    currentGame,
    currentPlayer,
    engine,
    initEngine,
    loadGame,
    meshDetails,
    meshForMenu,
    restoreCamera,
    saveCamera,
    sendToThread,
    stackSize,
    thread
  } from '../stores'

  export let params = {}

  let canvas
  let interaction
  let openInviteDialogue = false
  let loadPromise
  let peerAsideDimension = '20%'
  let discussionDimension = '15%'

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

  onMount(async () => {
    initEngine({ canvas, interaction })
    loadPromise = loadGame(params.gameId, $engine)
  })

  onDestroy(() => $engine?.dispose())

  function handleResize() {
    $engine?.resize()
  }

  function handlePeerAsideResize() {
    peerAsideDimension = 'auto'
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
    @apply absolute h-full z-10 top-0 bottom-0;

    &.right {
      @apply right-0;
      background-color: theme('backgrounds.page');
    }

    &.left {
      @apply flex flex-col left-0 p-2 gap-2;
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
    {error.message}
  </div>
{/await}

<aside class="left">
  <GameMenu on:invite-player={() => (openInviteDialogue = true)} />
  <InvitePlayerDialogue
    gameId={params.gameId}
    open={openInviteDialogue}
    on:close={() => (openInviteDialogue = false)}
  />
  <span class="flex-1" />
  <CameraSwitch
    saveCount={($cameraSaves?.length ?? 0) + 1}
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
  <StackSizeTooltip size={$stackSize} />
  <ObjectDetails data={$meshDetails} />
</main>
{#if $currentGame?.players.length > 1}
  <aside class="right" style="width: {peerAsideDimension}">
    <MinimizableSection
      placement="right"
      icon="people_alt"
      on:resize={handlePeerAsideResize}
      on:minimize={handlePeerAsideResize}
    >
      <div class="right-content">
        <div class="peers">
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
      </div>
    </MinimizableSection>
  </aside>
{/if}
