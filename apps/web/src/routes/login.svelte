<script>
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { writable } from 'svelte/store'
  import { _ } from 'svelte-intl'
  import { LogInForm } from '../components'
  import { logIn, flags } from '../stores'

  let inputRef = null
  // use writable because change will happen asynchronously
  const username = writable()
  const password = writable()
  const error = writable()
  const redirect = $page.url.searchParams.get('redirect') ?? '/home'

  $: if (inputRef) {
    inputRef.focus()
  }

  async function handleLogin() {
    try {
      await logIn($username, $password)
      goto(redirect, { replaceState: true })
    } catch (err) {
      username.set('')
      password.set('')
      error.set($_('errors.login-failure'))
    }
  }
</script>

<svelte:head>
  <title>{$_('page-titles.log-in')}</title>
</svelte:head>

<main>
  <LogInForm
    bind:inputRef
    bind:username={$username}
    bind:password={$password}
    error={$error}
    {redirect}
    withGithub={$flags.useGithubProvider}
    withGoogle={$flags.useGoogleProvider}
    on:submit={handleLogin}
  />
</main>

<style lang="postcss">
  main {
    @apply flex flex-col p-4 h-full lg:w-1/2 lg:mx-auto;
  }
</style>
