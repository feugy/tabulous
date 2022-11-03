<script>
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { _ } from 'svelte-intl'
  import { Button } from '../../../../components'
  import { Header } from '../../../../connected-components'
  import { createGame } from '../../../../stores'

  /** @type {import('./$types').PageData} */
  export let data = {}

  const gameName = $page.url.searchParams.get('name')
  let error

  onMount(async () => {
    if (gameName) {
      try {
        goto(await createGame(gameName), { replaceState: true })
      } catch (err) {
        error = translateError(err.message)
      }
    } else {
      goto('/home')
    }
  })

  function translateError(message) {
    const translate = get(_)
    if (/^Access to game/.test(message)) {
      return translate('errors.restricted-game')
    }
    const match = message.match(/^You own (\d+) games/)
    if (match) {
      return translate('errors.too-many-games', { count: match[1] })
    }
    return null
  }
</script>

<svelte:head>
  <title>{$_('page-titles.create-game')}</title>
</svelte:head>

<main>
  <Header
    user={data.session?.player}
    breadcrumb={[
      { label: $_('labels.home'), href: '/' },
      { label: $_('titles.create-game') }
    ]}
  />
  <section>
    {#if error}
      <p>{error}</p>
    {/if}
    <a href="/home"><Button text={$_('labels.home')} icon="arrow_back" /></a>
  </section>
</main>

<style lang="postcss">
  main {
    @apply flex flex-col w-full pb-8;
  }

  section {
    @apply flex flex-col lg:w-3/4 lg:mx-auto;
  }

  p {
    @apply text-2xl pt-8 pb-4;
  }
</style>
