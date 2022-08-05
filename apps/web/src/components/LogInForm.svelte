<script>
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-intl'
  import Button from './Button.svelte'
  import Input from './Input.svelte'
  import Pane from './Pane.svelte'
  import { authUrl } from '../utils'
  import GithubLogo from '../../public/images/github-logo.svg'
  import GoogleLogo from '../../public/images/google-logo.svg'

  export let username = ''
  export let password = ''
  export let redirect = null
  export let inputRef = null
  export let error = null
  export let withGoogle = false
  export let withGithub = false

  const dispatch = createEventDispatcher()

  $: hasProviders = withGoogle || withGithub
  $: disabled =
    !username ||
    username.trim().length === 0 ||
    !password ||
    password.trim().length <= 3

  let details
  let isPasswordOpen = false

  function handleLogin() {
    dispatch('submit', { username, password })
  }

  function resetError() {
    error = null
  }

  function handleConnectWith(provider) {
    let url = `${authUrl}/${provider}/connect`
    if (redirect) {
      url += '?' + new URLSearchParams({ redirect }).toString()
    }
    window.location.href = url
  }

  function handleTogglePassword() {
    isPasswordOpen = details.open
  }
</script>

<Pane>
  <h1 class="heading">{$_('titles.log-in')}</h1>
  <div class="container">
    {#if withGithub && !isPasswordOpen}
      <Button
        text={$_('actions.log-in-github')}
        on:click={() => handleConnectWith('github')}
        ><GithubLogo slot="icon" /></Button
      >
    {/if}
    {#if withGoogle && !isPasswordOpen}
      <Button
        text={$_('actions.log-in-google')}
        on:click={() => handleConnectWith('google')}
        ><GoogleLogo slot="icon" /></Button
      >
    {/if}
    <details
      bind:this={details}
      open={!hasProviders}
      on:toggle={handleTogglePassword}
    >
      <summary class:hidden={!hasProviders} title="password-toggle">
        <span class="material-icons"
          >{isPasswordOpen ? 'arrow_back' : 'arrow_forward'}</span
        >{$_(
          isPasswordOpen ? 'actions.log-in-others' : 'actions.log-in-password'
        )}
      </summary>
      <form on:submit|preventDefault={handleLogin}>
        <div class="row">
          <Input
            placeholder={$_('placeholders.username')}
            bind:value={username}
            bind:ref={inputRef}
            on:input={resetError}
          />
        </div>
        <div class="row">
          <Input
            type="password"
            placeholder={$_('placeholders.password')}
            data-testid="password"
            bind:value={password}
            on:input={resetError}
          />
        </div>
        {#if error}
          <div class="error">{error}</div>
        {:else}
          <div class="actions">
            <Button
              text={$_('actions.log-in')}
              icon="emoji_people"
              type="submit"
              {disabled}
            />
          </div>
        {/if}
      </form>
    </details>
  </div>
</Pane>

<style lang="postcss">
  h1 {
    @apply inline-block;
  }

  .row {
    @apply flex my-4 items-center gap-2;
  }

  .actions {
    @apply flex justify-center;
  }

  .container {
    @apply flex flex-col gap-4 whitespace-nowrap w-min mx-auto my-0;
  }

  details {
    @apply text-center min-w-200px;
  }

  summary {
    @apply inline-block py-2 px-4 cursor-pointer list-none;

    &.hidden {
      @apply hidden;
    }
  }

  .error {
    @apply text-center text-$accent-warm;
  }
</style>
