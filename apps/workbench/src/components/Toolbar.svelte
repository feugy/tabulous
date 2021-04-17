<script>
  import { _ } from 'svelte-intl'

  export let viewport

  // TODO dropdown for viewports and background colors

  // TODO pre-configured viewports
  let isViewPortActive = false
  let viewPortWidth = 1112
  let viewPortHeight = 832

  const backgrounds = ['', 'white', 'black']
  // TODO configurable color
  let currentBackground = 0

  $: if (viewport && isViewPortActive) {
    const width = parseInt(viewPortWidth)
    const height = parseInt(viewPortHeight)
    if (!isNaN(width) && !isNaN(height) && width > 10 && height > 10) {
      viewPortWidth = width
      viewPortHeight = height
      viewport.firstChild.style.width = `${viewPortWidth}px`
      viewport.firstChild.style.height = `${viewPortHeight}px`
    }
  }

  function toggleViewPort() {
    if (!viewport) {
      return
    }
    isViewPortActive = !isViewPortActive
    const { style, classList } = viewport.firstChild
    if (isViewPortActive) {
      style.width = `${viewPortWidth}px`
      style.height = `${viewPortHeight}px`
      classList.add('viewport-frame')
    } else {
      style.width = '100%'
      style.height = '100%'
      classList.remove('viewport-frame')
    }
  }

  function invertViewPort() {
    // eslint-disable-next-line no-extra-semi
    ;[viewPortWidth, viewPortHeight] = [viewPortHeight, viewPortWidth]
  }

  function cycleBackgrounds() {
    currentBackground = (currentBackground + 1) % backgrounds.length
    if (viewport) {
      viewport.style.backgroundColor = backgrounds[currentBackground]
      viewport.style.backgroundImage = currentBackground === 0 ? '' : 'none'
    }
  }
</script>

<style type="postcss">
  :global(.viewport-frame) {
    @apply border m-8;
    border-color: theme('colors.primary.main');
    border-style: solid !important;
  }

  nav {
    @apply w-full py-2 px-4 border-b text-center;
    border-color: theme('colors.primary.main');
  }
  ul {
    @apply inline-flex;
    & > li {
      @apply px-2;
      & + li {
        @apply border-l;
        border-color: theme('colors.primary.main');
      }
    }
  }
  input {
    @apply w-10 border bg-transparent outline-none;

    &.width {
      @apply text-right;
    }
  }

  button {
    @apply outline-none;
    transition: transform 250ms;

    &:focus,
    &:hover {
      transform: scale(1.2);
    }
  }

  .input-bar {
    white-space: nowrap;
  }
</style>

<nav>
  <ul>
    <li>
      <button title={$_('tooltip.background')} on:click={cycleBackgrounds}
        ><span class="material-icons">wallpaper</span></button
      >
    </li>
    <li>
      <button title={$_('tooltip.viewport')} on:click={toggleViewPort}
        ><span class="material-icons">devices</span></button
      >
      {#if isViewPortActive}
        <span class="input-bar">
          <input class="width" bind:value={viewPortWidth} />
          <button on:click={invertViewPort}
            ><span class="material-icons">swap_horiz</span></button
          >
          <input class="height" bind:value={viewPortHeight} />
        </span>
      {/if}
    </li>
  </ul>
</nav>
