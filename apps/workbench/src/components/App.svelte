<script>
  import { onMount } from 'svelte'
  import { _, locale, translations, getBrowserLocale } from 'svelte-intl'
  import Explorer from './Explorer.svelte'
  import '../style.svelte'
  import fr from '../locales/fr.yaml'
  import {
    toolsMap,
    currentTool,
    selectTool,
    setWorkbenchFrame
  } from '../stores/app'

  translations.update({ fr })
  locale.set(getBrowserLocale('fr'))

  let frame

  // TODO configure
  const src = 'http://localhost:8080/workbench.html'
  onMount(() => setWorkbenchFrame(frame))
</script>

<style type="postcss">
  aside {
    @apply p-4;

    h1 {
      @apply text-2xl;
    }

    & li {
      @apply cursor-pointer py-2;

      &.current {
        @apply underline;
      }
    }
  }

  main {
    @apply flex-grow;
  }

  iframe {
    @apply w-full h-full border-none;
  }
</style>

<svelte:head>
  <title>{$_('UI Workbench')}</title>
</svelte:head>

<Explorer
  toolsGroup={$toolsMap}
  current={$currentTool}
  on:select={({ detail }) => selectTool(detail)}
/>
<main>
  <iframe title="preview" bind:this={frame} {src} />
</main>
