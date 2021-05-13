<script>
  import { _ } from 'svelte-intl'
  import { replace, querystring } from 'svelte-spa-router'
  import { Button, Input, Pane } from '../components'
  import { logIn } from '../stores'

  let username = ''
  $: disabled = !username || username.trim().length === 0

  async function handleLogin() {
    try {
      await logIn(username)
      const redirect = new URLSearchParams($querystring).get('redirect')
      replace(redirect || '/home')
    } catch {
      // TODO login failure
    }
  }
</script>

<style type="postcss">
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
          placeholder={$_('placeholders.user-name')}
          bind:value={username}
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
