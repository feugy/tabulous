<script>
  import { Aside } from '@src/components'
  import {
    connected,
    currentGame,
    gamePlayerById,
    joinGame,
    leaveGame,
    listFriends,
    playerColor,
    sendToThread,
    thread,
    toastError,
    toastInfo
  } from '@src/stores'
  import {
    actionMenuProps,
    engineLoading,
    handMeshes,
    handVisible,
    highlightHand,
    initEngine,
    longInputs,
    meshDetails
  } from '@src/stores/game-engine'
  import {
    initIndicators,
    visibleFeedbacks,
    visibleIndicators
  } from '@src/stores/indicators'
  import { applyGameColors, isLobby, observeDimension } from '@src/utils'
  import { onMount } from 'svelte'
  import { locale } from 'svelte-intl'

  import { browser } from '$app/environment'
  import { beforeNavigate, goto } from '$app/navigation'
  import { page } from '$app/stores'

  import CursorInfo from './CursorInfo.svelte'
  import GameHand from './GameHand.svelte'
  import GameMenu from './GameMenu.svelte'
  import Indicators from './Indicators.svelte'
  import LoadingScreen from './LoadingScreen'
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
  let dimensionObserver
  let dimensionSubscription
  let gameParameters
  let friends
  let restoreColors
  let isJoining = false

  $: if (browser && $playerColor) {
    document.documentElement.style.setProperty('--svg-highlight', $playerColor)
  }
  $: actionNamesByButton =
    $engineLoading || engine ? engine.actionNamesByButton : undefined
  $: actionNamesByKey =
    $engineLoading || engine ? engine.actionNamesByKey : undefined

  onMount(() => {
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
    friends = listFriends()
    return () => restoreColors?.()
  })

  beforeNavigate(async () => {
    restoreColors?.()
    dimensionObserver?.disconnect()
    dimensionSubscription?.unsubscribe()
    await leaveGame(data.session.player)
    engine?.dispose()
  })

  async function askForGame(parameters) {
    gameParameters = null
    try {
      isJoining = true
      const result = await joinGame({
        gameId: $page.params.gameId,
        ...data.session,
        parameters,
        onDeletion: () => {
          toastInfo({ contentKey: 'labels.game-deleted-by-owner' })
          goto(`/${$locale}/home`)
        }
      })
      restoreColors = applyGameColors(result.colors)
      if (result?.schemaString) {
        gameParameters = {
          schema: JSON.parse(result.schemaString)
        }
      }
      if (isLobby(result)) {
        goto(`/${$locale}/home`)
      }
    } catch (err) {
      console.error(err)
      toastError({ content: err.message })
      goto(`/${$locale}/home`)
    } finally {
      isJoining = false
    }
  }

  function handleCloseDetails() {
    interaction?.focus()
  }

  function handleSubmitParameters({ detail: parameters }) {
    askForGame(parameters)
  }
</script>

<div class="overlay">
  <LoadingScreen visible={$engineLoading || isJoining} {actionNamesByButton} />
  <Aside
    game={$currentGame}
    player={data.session.player}
    playerById={$gamePlayerById}
    connected={$connected}
    thread={$thread}
    friends={$friends}
    {actionNamesByButton}
    {actionNamesByKey}
    on:sendMessage={({ detail }) => sendToThread(detail.text)}
  />
</div>
<GameMenu {longTapDelay} />
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
</main>

<style lang="postcss">
  main,
  .overlay {
    @apply absolute inset-0 flex items-stretch overflow-hidden z-1;
  }

  .overlay {
    @apply z-10 justify-end pointer-events-none;
  }

  main {
    container-type: inline-size;

    :global(> aside) {
      @apply absolute inset-y-0 right-0;
    }
  }

  .interaction {
    @apply select-none flex-1 relative;
    touch-action: none;
    cursor: var(--cursor);
  }

  canvas {
    @apply absolute top-0 left-0 select-none h-full w-full;
    touch-action: none;
  }
</style>
