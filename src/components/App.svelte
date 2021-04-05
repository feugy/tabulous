<script>
  import { onMount } from 'svelte'
  import { _ } from 'svelte-intl'
  import {
    ActionMenu,
    Chat,
    Connect,
    FPSViewer,
    StackSizeTooltip
  } from './index'
  import {
    createCamera,
    createEngine,
    createLight,
    createTable,
    showAxis
  } from '../3d'
  import { initEngine, initCommunication, loadScene } from '../stores'
  import { default as splendor } from '../games/splendor/scene.json'

  let canvas
  let interaction
  let engine

  onMount(() => {
    engine = createEngine({ canvas, interaction })

    initEngine(engine)
    createCamera()
    // showAxis(2)
    createTable()
    // create light after table, so table doesn't project shadow
    createLight()

    engine.start()
    loadScene(splendor)
    initCommunication()
    return () => engine.dispose()
  })

  function handleResize() {
    engine?.resize()
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
</style>

<svelte:head>
  <title>{$_('tabulous')}</title>
</svelte:head>

<svelte:window on:resize={handleResize} />

<main>
  <div class="interaction" bind:this={interaction}>
    <canvas bind:this={canvas} />
    <ActionMenu />
  </div>
  <Connect />
  <Chat />
  <FPSViewer />
  <StackSizeTooltip />
</main>
