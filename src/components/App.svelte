<script>
  import Babylon from 'babylonjs'
  import { createCamera, createCard, createLight, createTable } from '../3d'
  const { Engine, Scene } = Babylon

  let canvas
  let interaction
  let engine

  $: if (!!canvas && !!interaction) {
    engine = new Engine(canvas, true)
    engine.inputElement = interaction

    const scene = new Scene(engine)
    createCamera()
    // showAxis(2)
    createTable()
    // create light after table, so table doesn't project shadow
    createLight()

    const card1 = createCard({
      x: -4,
      front: 'images/splendor/1/ruby-1.png',
      back: 'images/splendor/1/back.png'
    })
    const card2 = createCard({
      front: 'images/splendor/2/diamond-1.png',
      back: 'images/splendor/2/back.png'
    })
    const card3 = createCard({
      x: 4,
      front: 'images/splendor/3/sapphire-1.png',
      back: 'images/splendor/3/back.png'
    })

    engine.runRenderLoop(function () {
      scene.render()
    })
  }

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
