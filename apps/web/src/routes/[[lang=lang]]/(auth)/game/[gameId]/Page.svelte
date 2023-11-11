<script>
  // @ts-check
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
    handMeshCount,
    handVisible,
    highlightHand,
    history,
    initEngine,
    longInputs,
    meshDetails,
    replayHistory,
    replayRank,
    scores
  } from '@src/stores/game-engine'
  import {
    areIndicatorsVisible,
    initIndicators,
    visibleFeedbacks,
    visibleIndicators
  } from '@src/stores/indicators'
  import { applyGameColors, isLobby, observeDimension } from '@src/utils'
  import { onMount } from 'svelte'
  import { _, locale } from 'svelte-intl'

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
  import Scores from './Scores.svelte'

  /** @type {import('./$types').PageData} */
  export let data

  const session = /** @type {import('@src/graphql').AuthenticatedPlayer} */ (
    data.session
  )
  const longTapDelay = 500
  /** @type {import('@babylonjs/core').Engine} */
  let engine
  /** @type {?HTMLCanvasElement} */
  let canvas
  /** @type {?HTMLDivElement} */
  let interaction
  /** @type {?HTMLDivElement} */
  let hand
  /** @type {import('@src/utils').SizeObserver}*/
  let dimensionObserver
  /** @type {import('rxjs').Subscription} */
  let dimensionSubscription
  /** @type {?import('@tabulous/types').GameParameters<?>} */
  let gameParameters = null
  /** @type {import('rxjs').Observable<import('@src/graphql').Friendship[]>} */
  let friends
  /** @type {?() => void} */
  let restoreColors = null
  let isJoining = false

  $: if (browser && $playerColor) {
    document.documentElement.style.setProperty('--svg-highlight', $playerColor)
  }
  $: actionNamesByButton =
    $engineLoading || engine ? engine.actionNamesByButton : undefined
  $: actionNamesByKey =
    $engineLoading || engine ? engine.actionNamesByKey : undefined

  onMount(() => {
    if (canvas && interaction && hand) {
      engine = initEngine({
        canvas,
        interaction,
        longTapDelay,
        pointerThrottle: 150,
        hand
      })
      initIndicators({ engine, canvas, hand })
      askForGame()
      dimensionObserver = observeDimension(interaction, 0)
      dimensionSubscription = dimensionObserver.dimension$.subscribe(
        ({ width, height }) => {
          if (canvas) {
            canvas.style.width = `${width}px`
            canvas.style.height = `${height}px`
            engine?.resize()
          }
        }
      )
    }
    friends = listFriends()
    return () => restoreColors?.()
  })

  beforeNavigate(async () => {
    restoreColors?.()
    dimensionObserver?.disconnect()
    dimensionSubscription?.unsubscribe()
    await leaveGame(session.player)
    engine?.dispose()
  })

  async function askForGame(
    /** @type {import('@src/types').JSONValue|undefined} */ parameters
  ) {
    gameParameters = null
    try {
      isJoining = true
      const result = await joinGame({
        gameId: $page.params.gameId,
        ...session,
        parameters,
        onDeletion: () => {
          toastInfo({ contentKey: 'labels.game-deleted-by-owner' })
          goto(`/${$locale}/home`)
        }
      })
      if (!result) {
        throw new Error($_('errors.unexisting-game'))
      }
      restoreColors = applyGameColors(result.colors ?? {})
      if (result && 'schema' in result && result.schema) {
        gameParameters =
          /** @type {import('@tabulous/types').GameParameters<?>} */ (result)
      }
      if (isLobby(result)) {
        goto(`/${$locale}/home`)
      }
    } catch (err) {
      console.error(err)
      toastError({ content: /** @type {Error} */ (err).message })
      goto(`/${$locale}/home`)
    } finally {
      isJoining = false
    }
  }

  function handleSubmitParameters(
    /** @type {CustomEvent<{ submit: JSONValue }>} */ { detail: parameters }
  ) {
    askForGame(parameters)
  }
</script>

<div class="overlay">
  <LoadingScreen visible={$engineLoading || isJoining} {actionNamesByButton} />
  <Aside
    game={$currentGame}
    user={session.player}
    playerById={$gamePlayerById}
    connected={$connected}
    thread={$thread}
    history={$history}
    friends={$friends}
    replayRank={$replayRank}
    {actionNamesByButton}
    {actionNamesByKey}
    on:sendMessage={({ detail }) => sendToThread(detail.text)}
    on:replay={({ detail }) => replayHistory(detail)}
  />
  <Scores
    scores={$areIndicatorsVisible ? $scores : null}
    playerById={$gamePlayerById}
  />
</div>
<GameMenu user={session.player} {longTapDelay} />
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
      meshCount={$handMeshCount}
      color={$playerColor}
      bind:node={hand}
    />
    {#if gameParameters}
      <Parameters
        schema={gameParameters.schema}
        on:submit={handleSubmitParameters}
      />
    {/if}
    <MeshDetails details={$meshDetails} />
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
