<script>
  import { page, session } from '$app/stores'
  import { onMount, onDestroy } from 'svelte'
  import { _ } from 'svelte-intl'
  import { GameMenu, InvitePlayerDialogue } from '../../connected-components'
  import {
    CameraSwitch,
    CursorInfo,
    GameAside,
    GameHand,
    Indicators,
    MeshDetails,
    Progress,
    RadialMenu
  } from '../../components'
  import {
    actionMenuProps,
    cameraSaves,
    connected,
    currentCamera,
    currentGame,
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
  } from '../../stores'
  import { observeDimension } from '../../utils'

  const longTapDelay = 250
  let engine
  let canvas
  let interaction
  let hand
  let openInviteDialogue = false
  let loadPromise
  let dimensionObserver
  let dimensionSubscription

  onMount(async () => {
    engine = initEngine({ canvas, interaction, longTapDelay, hand })
    initIndicators({ engine, canvas, hand })
    loadPromise = loadGame($page.params.gameId, $session)
    loadPromise.catch(err => console.error(err))
    dimensionObserver = observeDimension(interaction, 0)
    dimensionSubscription = dimensionObserver.dimension$.subscribe(
      ({ width, height }) => {
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        engine?.resize()
      }
    )
  })

  onDestroy(() => {
    engine?.dispose()
    dimensionObserver?.disconnect()
    dimensionSubscription?.unsubscribe()
  })

  function handleCloseDetails() {
    interaction?.focus()
  }
</script>

<svelte:head>
  <title>{$_('page-titles.game')}</title>
</svelte:head>

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
  <!-- svelte-ignore a11y-autofocus -->
  <div
    class="interaction"
    tabindex="0"
    autofocus
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
    <MeshDetails mesh={$meshDetails} on:close={handleCloseDetails} />
  </div>
  <RadialMenu {...$actionMenuProps || {}} />
  <CursorInfo halos={longInputs} />
  <GameAside
    game={$currentGame}
    player={$session.user}
    playerById={$gamePlayerById}
    connected={$connected}
    thread={$thread}
    on:sendMessage={({ detail }) => sendToThread(detail.text)}
  />
</main>

<style lang="postcss">
  main,
  .overlay {
    @apply absolute inset-0 flex items-stretch overflow-hidden;
  }

  .interaction {
    @apply select-none flex-1 relative;
    touch-action: none;
  }

  canvas {
    @apply absolute top-0 left-0 select-none h-full w-full;
    touch-action: none;
  }

  aside.top {
    @apply absolute z-10 top-0 left-0 p-2;
  }

  .overlay {
    @apply flex items-center justify-center z-10;
  }
</style>
