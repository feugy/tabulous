<script>
  import { _ } from 'svelte-intl'

  import Loading from './LoadingScreen'

  /** @type {import('./$types').PageData} */
  export let data = {}
</script>

<svelte:head>
  <title>{$_('page-titles.game')}</title>
</svelte:head>
{#await import('./Page.svelte')}
  <Loading />
{:then { default: page }}
  <svelte:component this={page} {data} />
{/await}
