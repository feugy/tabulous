<script>
  import { Header, PageFooter } from '@src/components'
  import { flags } from '@src/stores'
  import { _ } from 'svelte-intl'

  import { page } from '$app/stores'

  import Form from './Form.svelte'

  /** @type {import('./$types').ActionData} */
  export let form = null

  let inputRef = null
  const redirect = $page.url?.searchParams.get('redirect')

  $: if (inputRef) {
    inputRef.focus()
  }
</script>

<svelte:head>
  <title>{$_('page-titles.log-in')}</title>
</svelte:head>

<main>
  <i id="top" />
  <Header><h1>{$_('titles.log-in')}</h1></Header>
  <section>
    <Form
      bind:inputRef
      error={form ? $_('errors.login-failure') : undefined}
      {redirect}
      withGithub={$flags.useGithubProvider}
      withGoogle={$flags.useGoogleProvider}
    />
  </section>
  <PageFooter />
</main>

<style lang="postcss">
  main {
    @apply flex flex-col h-screen w-screen;
  }

  section {
    @apply flex-1 pt-6 px-6 self-center w-full xl:w-screen-xl;
  }
</style>
