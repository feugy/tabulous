<script>
  import { onMount, onDestroy } from 'svelte'
  import { _ } from 'svelte-intl'
  import {
    FPSViewer,
    GameMenu,
    InvitePlayerDialogue
  } from '../connected-components'
  import {
    ActionMenu,
    CameraSwitch,
    Discussion,
    ObjectDetails,
    PlayerAvatar,
    Progress,
    StackSizeTooltip
  } from '../components'
  import {
    cameraSaves,
    connected,
    currentGame,
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

  onMount(async () => {
    initEngine({ canvas, interaction })
    loadPromise = loadGame(params.gameId, $engine)
  })

  onDestroy(() => $engine?.dispose())

  function handleResize() {
    $engine?.resize()
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
    @apply absolute z-10;

    &.right {
      @apply flex flex-col items-center top-2 right-2 gap-2;
      max-height: 93vh;
      width: 150px;

      @screen lg {
        width: 200px;
      }
      @screen xl {
        width: 300px;
      }
      @screen 2xl {
        width: 350px;
      }
    }

    &.left {
      @apply top-2 left-2 flex flex-col gap-2;
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
  <FPSViewer />
  <ObjectDetails data={$meshDetails} />
</main>
<aside class="right">
  {#each $connected as { player, stream }, i}
    <PlayerAvatar {player} {stream} controllable={i === 0} />
  {/each}
  {#if $connected.length || $thread.length}
    <Discussion
      thread={$thread}
      players={$currentGame?.players}
      on:sendMessage={({ detail }) => sendToThread(detail.text)}
    />
  {/if}
</aside>
