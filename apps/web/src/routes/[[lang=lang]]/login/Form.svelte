<script>
  import { Button, Input, Pane } from '@src/components'
  import GithubLogo from '@src/svg/github-logo.svg?component'
  import GoogleLogo from '@src/svg/google-logo.svg?component'
  import { authUrl } from '@src/utils'
  import { _, locale } from 'svelte-intl'

  export let id = ''
  export let password = ''
  export let redirect = null
  export let inputRef = null
  export let error = null
  export let withGoogle = false
  export let withGithub = false

  $: hasProviders = withGoogle || withGithub
  $: disabled =
    !id || id.trim().length === 0 || !password || password.trim().length <= 3

  let details
  let isPasswordOpen = !!error

  function resetError() {
    error = null
  }

  function handleConnectWith(provider) {
    let url = `${authUrl}/${provider}/connect?${new URLSearchParams({
      redirect: window.location.origin + (redirect || `/${$locale}/home`)
    }).toString()}`
    window.location.href = url
  }

  function handleTogglePassword() {
    isPasswordOpen = details.open
    if (!isPasswordOpen) {
      resetError()
    }
  }
</script>

<Pane title={$_('titles.welcome')}>
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
      open={!hasProviders || isPasswordOpen}
      on:toggle={handleTogglePassword}
    >
      <summary class:hidden={!hasProviders} title="password-toggle">
        <span class="material-icons"
          >{isPasswordOpen ? 'arrow_back' : 'arrow_forward'}</span
        >{$_(
          isPasswordOpen ? 'actions.log-in-others' : 'actions.log-in-password'
        )}
      </summary>
      <form method="POST">
        <div class="row">
          <Input
            name="id"
            placeholder={$_('placeholders.playerId')}
            bind:value={id}
            bind:ref={inputRef}
            on:input={resetError}
          />
        </div>
        <div class="row">
          <Input
            name="password"
            type="password"
            placeholder={$_('placeholders.password')}
            data-testid="password"
            bind:value={password}
            on:input={resetError}
          />
        </div>
        {#if error}
          <div class="error">{error}</div>
        {/if}
        <div class="actions">
          <Button
            primary
            text={$_('actions.log-in')}
            icon="emoji_people"
            type="submit"
            {disabled}
          />
        </div>
        <input type="hidden" name="redirect" value={redirect} />
      </form>
    </details>
  </div>
</Pane>

<style lang="postcss">
  .row {
    @apply flex my-4 items-center gap-2;
  }

  .actions {
    @apply flex justify-center;
  }

  .container {
    @apply flex flex-col gap-4 whitespace-nowrap w-min mx-auto my-0 py-6;
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
