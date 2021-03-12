<script>
  import { onMount } from 'svelte'
  import Babylon from 'babylonjs'
  import {
    createCamera,
    createCard,
    createLight,
    createTable,
    showAxis
  } from '../3d'

  const { Engine, Scene } = Babylon

  let canvas
  let interaction
  let engine

  onMount(() => {
    engine = new Engine(canvas, true)
    engine.inputElement = interaction

    const scene = new Scene(engine)

    createCamera()
    // showAxis(2)
    createTable()
    // create light after table, so table doesn't project shadow
    createLight()

    const gems = ['ruby', 'diamond', 'sapphire']
    for (let x = -12; x <= 12; x += 4) {
      // for (let x = -4; x < 0; x += 4) {
      for (const gem of gems) {
        const i = gems.indexOf(gem)
        createCard({
          // id: gem,
          x,
          y: i * 5 - 5,
          front: `images/splendor/${i + 1}/${gem}-1.png`,
          back: `images/splendor/${i + 1}/back.png`,
          isFlipped: true
        })
      }
    }

    engine.runRenderLoop(scene.render.bind(scene))
    return () => engine?.dispose()
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

  div,
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
  <canvas bind:this={canvas} />
  <div bind:this={interaction} />
</main>
