<script>
  import { Header, PageFooter } from '@src/components'
  import { _ } from 'svelte-intl'

  import { page } from '$app/stores'

  import Form from './Form.svelte'
  import ScrollableTerms from './ScrollableTerms.svelte'

  /** @type {import('./$types').PageData} */
  export let data = {}

  const redirect = $page.url?.searchParams.get('redirect')

  let disabled = true
</script>

<svelte:head>
  <title>{$_('page-titles.accept-terms')}</title>
</svelte:head>

<main>
  <Header user={data.session?.player}><h1>{$_('titles.legal')}</h1></Header>
  <section>
    <h2>{$_('titles.welcome')}</h2>
    <p>{$_('labels.terms-intro')}</p>
    <ScrollableTerms on:end={() => (disabled = false)} />
    <Form {disabled} {redirect} />
  </section>
  <PageFooter />
</main>

<style lang="postcss">
  main {
    @apply flex flex-col max-h-screen overflow-auto;
  }

  section {
    @apply flex flex-col flex-1 px-6 self-center w-full xl:w-screen-xl overflow-hidden;

    & > p {
      @apply mb-6;
    }
  }
</style>
