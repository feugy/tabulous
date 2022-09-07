<script>
  import { _ } from 'svelte-intl'
  import { Header } from '../../connected-components'
  import { PlayerThumbnail, Input } from '../../components'

  export let data = {}
  const user = data.session.player
</script>

<svelte:head>
  <title>{$_('page-titles.account')}</title>
</svelte:head>

<main>
  <Header
    {user}
    breadcrumb={[
      { label: $_('labels.home'), href: '/home' },
      { label: $_('labels.account') }
    ]}
  >
    <h1>
      {$_('titles.account')}
    </h1>
  </Header>
  <section>
    <h2>{$_('titles.auth-provider')}</h2>
    <fieldset>
      {#if user.provider}
        <div>{$_('labels.oauth-provider', user)}</div>
      {:else}
        <div>{$_('labels.manual-provider', user)}</div>
      {/if}
      <label for="username">{$_('labels.username')}</label>
      <Input name="username" value={user.username} />
      <span>{$_('labels.avatar')}</span>
      <PlayerThumbnail player={user} dimension={150} />
    </fieldset>
  </section>
</main>

<style lang="postcss">
  main {
    @apply flex flex-col h-full w-full;
  }

  h1 {
    @apply text-3xl py-4;
  }

  h2 {
    @apply text-2xl pb-4;
  }

  section {
    @apply my-8 p-8 self-center lg:w-3/4 border rounded-md;
  }

  fieldset {
    @apply grid gap-x-8 gap-y-4 grid-cols-[auto,1fr] items-center;

    div {
      @apply col-span-2;
    }
  }
</style>
