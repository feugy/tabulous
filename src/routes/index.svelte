<script>
  import { onDestroy } from 'svelte'
  import createWorld from '../components/World'
  import createTable from '../components/Table'
  import createCard from '../components/Card'
  import CameraControls from '../components/CameraControls.svelte'

  let container
  let world

  $: if (!!container && !world) {
    world = createWorld({ container })
    const table = createTable()
    const card1 = createCard({
      x: -3,
      sideA: 'images/splendor/1/ruby-1.png',
      sideB: 'images/splendor/1/back.png'
    })
    const card2 = createCard({
      sideA: 'images/splendor/2/diamond-1.png',
      sideB: 'images/splendor/2/back.png'
    })
    const card3 = createCard({
      x: 3,
      sideA: 'images/splendor/3/sapphire-1.png',
      sideB: 'images/splendor/3/back.png'
    })
    world.scene.add(
      table.instance,
      card1.instance,
      card2.instance,
      card3.instance
    )
    world.renderer.addUpdatable(card1, card2, card3)
  }

  onDestroy(() => {
    if (world) {
      world.dispose()
    }
  })
</script>

<style>
  :global(body, html, #sapper) {
    margin: 0;
    height: 100%;
    overflow: hidden;
  }

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

<svelte:head>
  <title>Board Forge</title>
</svelte:head>

{#if typeof window !== 'undefined'}
  <main>
    <div bind:this={container} />
    <div>
      {#if world}
        <CameraControls camera={world.camera} />
      {/if}
    </div>
  </main>
{/if}
