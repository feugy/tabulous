<script>
  import { onMount, onDestroy } from 'svelte'
  import { _ } from 'svelte-intl'
  import {
    // FPSViewer,
    GameMenu,
    InvitePlayerDialogue
  } from '../connected-components'
  import {
    CameraSwitch,
    CursorInfo,
    GameAside,
    MeshDetails,
    Progress,
    RadialMenu,
    StackSizes
  } from '../components'
  import {
    actionMenuProps,
    cameraSaves,
    connected,
    currentCamera,
    currentGame,
    currentPlayer,
    engine,
    initEngine,
    stackSizes,
    loadGame,
    longInputs,
    meshDetails,
    restoreCamera,
    saveCamera,
    sendToThread,
    thread
  } from '../stores'

  export let params = {}

  const longTapDelay = 250
  let canvas
  let interaction
  let openInviteDialogue = false
  let loadPromise

  onMount(async () => {
    initEngine({ canvas, interaction, longTapDelay })
    loadPromise = loadGame(params.gameId)
  })

  onDestroy(() => $engine?.dispose())

  function handleResize() {
    $engine?.resize()
  }

  function handleCloseDetails() {
    interaction?.focus()
  }
</script>

<style lang="postcss">
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
    @apply absolute z-10 left-0 p-2;
    &.top {
      @apply top-0;
    }
    &.bottom {
      @apply bottom-0 flex flex-col gap-2;
    }
  }

  .overlay {
    @apply flex items-center justify-center z-10;
  }

  :global(.hand-overlay) {
    @apply absolute inset-0 pointer-events-none border-solid border-t-1 border-$secondary-light;
    min-height: 10vw;
  }

  :global(.hand-overlay.visible) {
    // box-shadow: 0px -1vw 5vw -4vw rgb(0, 255, 0);
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

<aside class="top">
  <GameMenu on:invite-player={() => (openInviteDialogue = true)} />
  <InvitePlayerDialogue
    game={$currentGame}
    open={openInviteDialogue}
    on:close={() => (openInviteDialogue = false)}
  />
</aside>
<aside class="bottom">
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
    <StackSizes items={$stackSizes} />
    <RadialMenu {...$actionMenuProps || {}} />
  </div>
  <CursorInfo halos={longInputs} />
  <MeshDetails mesh={$meshDetails} on:close={handleCloseDetails} />
</main>
<GameAside
  game={$currentGame}
  player={$currentPlayer}
  connected={$connected}
  thread={$thread}
  on:sendMessage={({ detail }) => sendToThread(detail.text)}
/>
