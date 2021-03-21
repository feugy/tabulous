<script>
  import { onMount } from 'svelte'
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
  import { initEngine, initPeer } from '../stores'
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
    engine.loadScene(splendor)
    initPeer()
    return () => engine.dispose()
  })

  function handleResize() {
    engine?.resize()
  }
</script>

<style>
  :global(body, html) {
    margin: 0;
    height: 100%;
    overflow: hidden;
    font-family: sans-serif;
  }

  main {
    position: relative;
    height: 100%;
  }

  .interaction,
  canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
  }
</style>

<svelte:head>
  <title>Board Forge</title>
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
