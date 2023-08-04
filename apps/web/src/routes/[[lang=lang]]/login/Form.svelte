<script>
  // @ts-check
  import { Button, Input, Pane } from '@src/components'
  import GithubLogo from '@src/svg/github-logo.svg?component'
  import GoogleLogo from '@src/svg/google-logo.svg?component'
  import { authUrl } from '@src/utils'
  import { _, locale } from 'svelte-intl'

  /** @type {string} username identifier. */
  export let id = ''
  /** @type {string} username password. */
  export let password = ''
  /** @type {?string} optional url to redirect to. */
  export let redirect = null
  /** @type {?HTMLInputElement} reference to the username input field for focusing. */
  export let inputRef = null
  /** @type {?string} optional authentication error string. */
  export let error = null
  /** @type {boolean} whether to display the "connect with Google" button. */
  export let withGoogle = false
  /** @type {boolean} whether to display the "connect with Github" button. */
  export let withGithub = false

  $: hasProviders = withGoogle || withGithub
  $: disabled =
    !id || id.trim().length === 0 || !password || password.trim().length <= 3

  /** @type {?HTMLDetailsElement} */
  let details
  let isPasswordOpen = !!error

  function resetError() {
    error = null
  }

  function handleConnectWith(/** @type {string} */ provider) {
    let url = `${authUrl}/${provider}/connect?${new URLSearchParams({
      redirect: window.location.origin + (redirect || `/${$locale}/home`)
    }).toString()}`
    window.location.href = url
  }

  function handleTogglePassword() {
    isPasswordOpen = Boolean(details?.open)
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
