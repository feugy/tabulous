<script>
  import { _ } from 'svelte-intl'
  import Form from './Form.svelte'
  import ScrollableTerms from './ScrollableTerms.svelte'
  import { Header } from '../../connected-components'

  /** @type {import('./$types').PageData} */
  export let data = {}

  let disabled = true
</script>

<svelte:head>
  <title>{$_('page-titles.accept-terms')}</title>
</svelte:head>

<main>
  <Header
    user={data.session?.player}
    breadcrumb={[
      { label: $_('labels.home'), href: '/' },
      { label: $_('labels.accept-terms') }
    ]}
  />
  <h1>{$_('titles.welcome')}</h1>
  <p>{$_('labels.terms-intro')}</p>
  <ScrollableTerms on:end={() => (disabled = false)} />
  <Form {disabled} />
</main>

<style lang="postcss">
  main {
    @apply flex flex-col w-full max-h-screen pb-8;

    & > p {
      @apply mb-4;
    }

    h1 {
      @apply text-3xl underline underline-$primary-light mt-8 mb-6;
    }

    :global(> *) {
      @apply px-2 mx-auto w-3/4 <lg:w-full;
    }
  }
</style>
