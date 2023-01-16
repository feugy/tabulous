<script>
  import { GameAside, InvitePlayerDialogue, Progress } from '@src/components'
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
    joinGame,
    leaveGame,
    longInputs,
    meshDetails,
    playerColor,
    restoreCamera,
    saveCamera,
    sendToThread,
    thread,
    toastError,
    toastInfo,
    visibleFeedbacks,
    visibleIndicators
  } from '@src/stores'
  import { isLobby, observeDimension } from '@src/utils'
  import { onMount } from 'svelte'
  import { _ } from 'svelte-intl'

  import { beforeNavigate, goto } from '$app/navigation'
  import { page } from '$app/stores'

  import CameraSwitch from './CameraSwitch.svelte'
  import CursorInfo from './CursorInfo.svelte'
  import GameHand from './GameHand.svelte'
  import GameMenu from './GameMenu.svelte'
  import Indicators from './Indicators.svelte'
  import MeshDetails from './MeshDetails.svelte'
  import Parameters from './Parameters'
  import RadialMenu from './RadialMenu.svelte'

  /** @type {import('./$types').PageData} */
  export let data = {}

  const longTapDelay = 250
  let engine
  let canvas
  let interaction
  let hand
  let openInviteDialogue = false
  let joinPromise
  let dimensionObserver
  let dimensionSubscription
  let gameParameters

  onMount(async () => {
    engine = initEngine({ canvas, interaction, longTapDelay, hand })
    initIndicators({ engine, canvas, hand })
    askForGame()
    dimensionObserver = observeDimension(interaction, 0)
    dimensionSubscription = dimensionObserver.dimension$.subscribe(
      ({ width, height }) => {
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        engine?.resize()
      }
    )
  })

  beforeNavigate(() => {
    leaveGame(data.session.player)
    engine?.dispose()
    dimensionObserver?.disconnect()
    dimensionSubscription?.unsubscribe()
  })

  function askForGame(parameters) {
    gameParameters = null
    joinPromise = joinGame({
      gameId: $page.params.gameId,
      ...data.session,
      parameters,
      onDeletion: () => {
        toastInfo({ contentKey: 'labels.game-deleted-by-owner' })
        goto('/home')
      }
    })
      .then(result => {
        if (result?.schemaString) {
          gameParameters = {
            schema: JSON.parse(result.schemaString)
          }
        }
        if (isLobby(result)) {
          goto('/home')
        }
      })
      .catch(err => {
        console.error(err)
        toastError({ content: err.message })
        goto('/home')
      })
  }

  function handleCloseDetails() {
    interaction?.focus()
  }

  function handleSubmitParameters({ detail: parameters }) {
    askForGame(parameters)
  }
</script>

<svelte:head>
  <title>{$_('page-titles.game')}</title>
</svelte:head>

{#await joinPromise}
  <div class="overlay">
    <Progress />
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
    {#if gameParameters}
      <Parameters
        schema={gameParameters.schema}
        on:submit={handleSubmitParameters}
      />
    {/if}
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

  main {
    container-type: inline-size;
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
    @apply absolute z-10 top-0 left-0 p-2 flex gap-2;
  }

  .overlay {
    @apply flex items-center justify-center z-10;
  }
</style>
