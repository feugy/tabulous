<script>
  import { onMount, onDestroy } from 'svelte'
  import { _ } from 'svelte-intl'
  import { GameMenu, InvitePlayerDialogue } from '../connected-components'
  import {
    CameraSwitch,
    CursorInfo,
    GameAside,
    GameHand,
    Indicators,
    MeshDetails,
    Progress,
    RadialMenu
  } from '../components'
  import {
    actionMenuProps,
    cameraSaves,
    connected,
    currentCamera,
    currentGame,
    currentPlayer,
    gamePlayerById,
    handMeshes,
    handVisible,
    highlightHand,
    initEngine,
    initIndicators,
    visibleIndicators,
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
  let engine
  let canvas
  let interaction
  let hand
  let openInviteDialogue = false
  let loadPromise

  onMount(async () => {
    engine = initEngine({ canvas, interaction, longTapDelay, hand })
    initIndicators({ engine, canvas, hand })
    loadPromise = loadGame(params.gameId)
    loadPromise.catch(err => console.error(err))
  })

  onDestroy(() => engine?.dispose())

  function handleResize() {
    engine?.resize()
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
    @apply absolute w-full h-full top-0 left-0 z-0 select-none;
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
  <CameraSwitch
    {longTapDelay}
    current={$currentCamera}
    saves={$cameraSaves}
    on:longTap={() => longInputs.next()}
    on:restore={({ detail: { index } }) => restoreCamera(index)}
    on:save={({ detail: { index } }) => saveCamera(index)}
  />
  <InvitePlayerDialogue
    game={$currentGame}
    open={openInviteDialogue}
    on:close={() => (openInviteDialogue = false)}
  />
</aside>
<main>
  <div
    class="interaction"
    bind:this={interaction}
    on:contextmenu|preventDefault
  >
    <canvas bind:this={canvas} />
    <Indicators items={$visibleIndicators} />
    <GameHand
      visible={$handVisible}
      highlight={$highlightHand}
      meshes={$handMeshes}
      bind:node={hand}
    />
    <RadialMenu {...$actionMenuProps || {}} />
  </div>
  <CursorInfo halos={longInputs} />
  <MeshDetails mesh={$meshDetails} on:close={handleCloseDetails} />
</main>
<GameAside
  game={$currentGame}
  player={$currentPlayer}
  playerById={$gamePlayerById}
  connected={$connected}
  thread={$thread}
  on:sendMessage={({ detail }) => sendToThread(detail.text)}
/>
