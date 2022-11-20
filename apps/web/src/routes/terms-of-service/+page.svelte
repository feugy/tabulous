<script>
  import { Header, Markdown, TermsOfService } from '@src/components'
  import { _ } from 'svelte-intl'

  /** @type {import('./$types').PageData} */
  export let data = {}
</script>

<svelte:head>
  <title>{$_('page-titles.terms-of-service')}</title>
</svelte:head>

<main>
  <Header
    user={data.session?.player}
    breadcrumb={[
      { label: $_('labels.home'), href: '/' },
      { label: $_('labels.terms-of-service') }
    ]}
  />

  <Markdown titleKey="titles.legal" contentKey="markdown.legal" />

  <TermsOfService />
</main>

<style lang="postcss">
  main {
    @apply flex flex-col w-full pb-8;

    :global(> *) {
      @apply px-2 mx-auto w-3/4 <lg:w-full;
    }
  }
</style>
