<script>
  import { _ } from 'svelte-intl'
  import { replace, querystring } from 'svelte-spa-router'
  import { Button, Input, Pane } from '../components'
  import { logIn } from '../stores'

  let username = ''
  let password = ''
  let inputRef

  $: disabled =
    !username ||
    username.trim().length === 0 ||
    !password ||
    password.trim().length <= 3

  $: if (inputRef) {
    inputRef.focus()
  }

  async function handleLogin() {
    try {
      await logIn(username, password)
      const redirect = new URLSearchParams($querystring).get('redirect')
      replace(redirect || '/home')
    } catch {
      // TODO login failure
    }
  }
</script>

<style lang="postcss">
  main {
    @apply flex flex-col p-4 h-full lg:w-1/2 lg:mx-auto;
  }

  h1 {
    @apply inline-block;
  }

  .row {
    @apply flex my-4 items-center gap-2;
  }

  .actions {
    @apply flex justify-center;
  }
</style>

<svelte:head>
  <title>{$_('page-titles.log-in')}</title>
</svelte:head>

<main>
  <Pane>
    <h1 class="heading">{$_('titles.log-in')}</h1>
    <form on:submit|preventDefault={handleLogin}>
      <div class="row">
        <Input
          placeholder={$_('placeholders.username')}
          bind:value={username}
          bind:ref={inputRef}
        />
      </div>
      <div class="row">
        <Input
          type="password"
          placeholder={$_('placeholders.password')}
          bind:value={password}
        />
      </div>
      <div class="actions">
        <Button
          text={$_('actions.log-in')}
          icon="emoji_people"
          type="submit"
          {disabled}
        />
      </div>
    </form>
  </Pane>
</main>
