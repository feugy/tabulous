<script>
  import { page } from '$app/stores'
  import { _ } from 'svelte-intl'
  import Form from './Form.svelte'
  import { flags } from '../../stores'

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
  <Form
    bind:inputRef
    error={form ? $_('errors.login-failure') : undefined}
    {redirect}
    withGithub={$flags.useGithubProvider}
    withGoogle={$flags.useGoogleProvider}
  />
</main>

<style lang="postcss">
  main {
    @apply flex flex-col p-4 h-full lg:w-1/2 lg:mx-auto;
  }
</style>
