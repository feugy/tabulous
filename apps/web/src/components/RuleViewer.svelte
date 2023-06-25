<script>
  import { gameAssetsUrl } from '@src/utils'
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'

  import Button from './Button.svelte'

  export let page = 0
  export let lastPage = 0
  export let game = ''
  export let maxZoom = 1.5
  export let minZoom = 0.3

  const dispatch = createEventDispatcher()
  let dimension = { width: 0, height: 0 }
  let zoom = minZoom
  let pos = null
  let container = null
  let image = null

  function handleNavigate(previous = false) {
    page += previous ? -1 : 1
    dispatch('change', { page })
  }

  function handleImageLoaded({ target }) {
    container.scrollTop = 0
    container.scrollLeft = 0
    setImageZoom(null)
    const { width, height } = target.getBoundingClientRect()
    dimension = { width, height }
    setImageZoom(zoom)
  }

  function handleDragStart({ clientX, clientY }) {
    pos = {
      left: container.scrollLeft,
      top: container.scrollTop,
      x: clientX,
      y: clientY
    }
    window.addEventListener('pointermove', handleDrag)
    window.addEventListener('pointerup', handleDragStop)
  }

  function handleDrag({ clientX, clientY }) {
    if (!pos) {
      return
    }
    container.scrollTop = pos.top - (clientY - pos.y)
    container.scrollLeft = pos.left - (clientX - pos.x)
  }

  function handleDragStop() {
    if (!pos) {
      return
    }
    pos = null
    window.removeEventListener('pointermove', handleDrag)
    window.removeEventListener('pointerup', handleDragStop)
  }

  function handleZoom({ deltaY }) {
    zoom = capZoom(zoom + (deltaY < 0 ? 0.1 : -0.1))
    setImageZoom(zoom)
  }

  function capZoom(zoom) {
    return zoom < minZoom ? minZoom : zoom > maxZoom ? maxZoom : zoom
  }

  function setImageZoom(zoom) {
    image.style.width = zoom ? `${dimension.width * zoom}px` : ''
    image.style.height = zoom ? `${dimension.height * zoom}px` : ''
  }
</script>

<section>
  <menu>
    <Button
      icon="navigate_before"
      disabled={page === 0}
      on:click={() => handleNavigate(true)}
    />
    {page + 1}/{lastPage + 1}
    <Button
      icon="navigate_next"
      disabled={page > lastPage - 1}
      on:click={() => handleNavigate()}
    />
  </menu>
  <div
    class="image-container"
    bind:this={container}
    on:pointerdown={handleDragStart}
    on:wheel|preventDefault={handleZoom}
  >
    {#if game}
      <img
        bind:this={image}
        alt={$_('tooltips.rule-page', { page: page + 1 })}
        src={`${gameAssetsUrl}/${game}/rules/${page + 1}.webp`}
        on:load={handleImageLoaded}
      />
    {/if}
  </div>
</section>

<style lang="postcss">
  section {
    @apply flex flex-col flex-1 max-h-full max-w-full items-center gap-2 p-4 select-none;
  }
  .image-container {
    @apply flex-1 w-full overflow-auto text-center;
    cursor: grab;
  }
  img {
    @apply inline-block max-h-none max-w-none pointer-events-none;
  }
  menu {
    @apply flex gap-2 m-0 p-0 items-center;
  }
</style>
