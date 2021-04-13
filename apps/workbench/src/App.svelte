<script>
  import { onMount } from 'svelte'
  import { _ } from 'svelte-intl'
  import { Explorer, Toolbar } from './components'
  import './common'
  import {
    toolsMap,
    currentTool,
    selectTool,
    setWorkbenchFrame
  } from './stores'

  let frame
  let viewport

  const src = 'http://localhost:8080/workbench.html' // new URLSearchParams(window.location.search).get('target')
  onMount(() => setWorkbenchFrame(frame))
</script>

<style type="postcss">
  main {
    @apply flex-grow flex flex-col overflow-hidden;
  }

  .viewport {
    @apply flex-grow overflow-auto text-center;
    background-image: radial-gradient(
      theme('colors.secondary.light') 1px,
      transparent 1px
    );
    background-size: 20px 20px;
  }

  iframe {
    @apply inline-block w-full h-full border-none;
  }
</style>

<svelte:head>
  <title>{$_('title.app')}</title>
</svelte:head>

<Explorer
  toolsGroup={$toolsMap}
  current={$currentTool}
  on:select={({ detail }) => selectTool(detail)}
>
  <Toolbar {viewport} />
</Explorer>
<main>
  <div class="viewport" bind:this={viewport}>
    <iframe title="preview" bind:this={frame} {src} />
  </div>
</main>
