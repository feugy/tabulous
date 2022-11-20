<script>
  import { Button, Header } from '@src/components'
  import { createGame } from '@src/stores'
  import { translateError } from '@src/utils'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { _ } from 'svelte-intl'

  import { goto } from '$app/navigation'
  import { page } from '$app/stores'

  /** @type {import('./$types').PageData} */
  export let data = {}

  const gameName = $page.url.searchParams.get('name')
  let error

  onMount(async () => {
    if (gameName) {
      try {
        goto(await createGame(gameName), { replaceState: true })
      } catch (err) {
        error = translateError(get(_), err)
      }
    } else {
      goto('/home')
    }
  })
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
