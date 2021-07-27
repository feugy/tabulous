<script>
  import { onMount, onDestroy } from 'svelte'
  import { _ } from 'svelte-intl'
  import { push } from 'svelte-spa-router'
  import {
    ActionMenu,
    FPSViewer,
    InviteDialogue,
    MeshDetails,
    StackSizeTooltip
  } from '../connected-components'
  import { Button, Discussion, PlayerAvatar } from '../components'
  import {
    connected,
    engine,
    initEngine,
    loadGame,
    moveCameraTo,
    thread,
    sendToThread
  } from '../stores'

  export let params = {}

  let canvas
  let interaction
  let openInvite = false

  onMount(async () => {
    initEngine({ canvas, interaction })
    await loadGame(params.gameId, $engine)
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
  canvas {
    @apply absolute w-full h-full top-0 left-0;
    touch-action: none;
  }

  aside {
    @apply absolute;

    &.right {
      @apply flex flex-col items-center top-14 right-2 gap-2;
      max-height: 93vh;
      width: 300px;
    }

    &.left {
      @apply top-2 left-2;
    }
  }

  nav {
    @apply absolute top-2 right-2;
  }
</style>

<svelte:head>
  <title>{$_('page-titles.game')}</title>
</svelte:head>

<svelte:window on:resize={handleResize} />

<main>
  <div class="interaction" bind:this={interaction}>
    <canvas bind:this={canvas} />
    <ActionMenu />
  </div>
  <StackSizeTooltip />
  <FPSViewer />
  <MeshDetails />
</main>
<nav>
  <Button
    icon="home"
    title={$_('tooltips.quit-game')}
    on:click={() => push('/home')}
  />
</nav>
<aside class="left">
  <Button
    icon="center_focus_strong"
    title={$_('tooltips.center-camera')}
    on:click={() => moveCameraTo()}
  />
</aside>
<aside class="right">
  {#each $connected as { player, stream }, i}
    <PlayerAvatar {player} {stream} controllable={i === 0} />
  {/each}
  <Discussion
    thread={$thread}
    on:sendMessage={({ detail }) => sendToThread(detail.text)}
    on:askInvite={() => (openInvite = true)}
  />
  <InviteDialogue
    gameId={params.gameId}
    open={openInvite}
    on:close={() => (openInvite = false)}
  />
</aside>
