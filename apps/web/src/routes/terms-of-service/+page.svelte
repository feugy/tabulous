<script>
  import { _ } from 'svelte-intl'
  import { TermsOfService } from '../../components'
  import { Header } from '../../connected-components'

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
