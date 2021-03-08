<script context="module">
  export const SCENE = 'SCENE'
  export const CAMERA = 'CAMERA'
  export const RENDERER = 'RENDERER'
</script>

<script>
  import { onMount, setContext } from 'svelte'
  import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
  import {
    startLoop,
    stopLoop,
    registerRenderer,
    unregisterRenderer
  } from '../stores'

  export let initialZoom = 7
  let canvasContainer
  let interaction
  let width
  let height

  const scene = new Scene()
  scene.background = new Color(0xeeeeee)
  const camera = new PerspectiveCamera(75, 1, 1, 10000)
  camera.position.set(0, 0, initialZoom)

  const renderer = new WebGLRenderer()
  renderer.physicallyCorrectLights = true
  setContext(SCENE, scene)
  setContext(CAMERA, camera)
  setContext(RENDERER, renderer)

  onMount(() => {
    registerRenderer(animate)
    startLoop()
    return () => {
      unregisterRenderer(animate)
      stopLoop()
    }
  })

  function animate() {
    renderer.render(scene, camera)
  }

  $: if (canvasContainer) {
    canvasContainer.appendChild(renderer.domElement)
    handleResize()
  }

  function handleResize() {
    ;({ width, height } = canvasContainer.getBoundingClientRect())
    if (camera && renderer) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      renderer.setPixelRatio(window.devicePixelRatio)
    }
  }
</script>

<style>
  main {
    position: relative;
    height: 100%;
  }

  div {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>

<svelte:window on:resize={handleResize} />

<main>
  <div bind:this={canvasContainer} />
  <div bind:this={interaction}>
    {#if renderer}
      <slot {width} {height} />
    {/if}
  </div>
</main>
