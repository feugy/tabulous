<script>
  import { Header, Markdown, PageFooter, TermsOfService } from '@src/components'
  import { _ } from 'svelte-intl'

  /** @type {import('./$types').PageData} */
  export let data = {}
</script>

<svelte:head>
  <title>{$_('page-titles.terms-of-service')}</title>
</svelte:head>

<main>
  <i id="top" />
  <Header user={data.session?.player}><h1>{$_('titles.legal')}</h1></Header>
  <section>
    <Markdown titleKey="titles.legal" contentKey="markdown.legal" />

    <TermsOfService />
  </section>
  <PageFooter />
</main>

<style lang="postcss">
  main {
    @apply flex flex-col max-h-screen overflow-auto;
    background: var(--page-bg);
  }

  section {
    @apply flex flex-col flex-1 px-6 self-center w-full xl:w-screen-xl p-x-8;
  }
</style>
