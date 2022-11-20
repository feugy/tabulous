<script>
  import { Progress } from '@src/components'
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
    loadGame,
    longInputs,
    meshDetails,
    playerColor,
    restoreCamera,
    saveCamera,
    sendToThread,
    thread,
    visibleFeedbacks,
    visibleIndicators
  } from '@src/stores'
  import { observeDimension } from '@src/utils'
  import { onDestroy, onMount } from 'svelte'
  import { _ } from 'svelte-intl'

  import { page } from '$app/stores'

  import CameraSwitch from './CameraSwitch.svelte'
  import CursorInfo from './CursorInfo.svelte'
  import GameAside from './GameAside.svelte'
  import GameHand from './GameHand.svelte'
  import GameMenu from './GameMenu.svelte'
  import Indicators from './Indicators.svelte'
  import InvitePlayerDialogue from './InvitePlayerDialogue.svelte'
  import MeshDetails from './MeshDetails.svelte'
  import RadialMenu from './RadialMenu.svelte'

  /** @type {import('./$types').PageData} */
  export let data = {}

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
    loadPromise = loadGame($page.params.gameId, data.session)
    loadPromise.catch(err => console.error(err))
    dimensionObserver = observeDimension(interaction, 0)
    dimensionSubscription = dimensionObserver.dimension$.subscribe(
      ({ width, height }) => {
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        engine?.resize()
      }
    )
    window.addEventListener('beforeunload', () => engine?.dispose())
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
    role="textbox"
    autofocus
    bind:this={interaction}
    on:contextmenu|preventDefault
  >
    <canvas bind:this={canvas} />
    <Indicators items={$visibleIndicators} feedbacks={$visibleFeedbacks} />
    <GameHand
      visible={$handVisible}
      highlight={$highlightHand}
      meshes={$handMeshes}
      color={$playerColor}
      bind:node={hand}
    />
    <MeshDetails mesh={$meshDetails} on:close={handleCloseDetails} />
  </div>
  <RadialMenu {...$actionMenuProps || {}} />
  <CursorInfo halos={longInputs} />
  <GameAside
    game={$currentGame}
    player={data.session.player}
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
