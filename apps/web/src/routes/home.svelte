<script>
  import { goto } from '$app/navigation'
  import { session } from '$app/stores'
  import { _, locale } from 'svelte-intl'
  import {
    CatalogItem,
    ConfirmDialogue,
    GameLink,
    Progress
  } from '../components'
  import { Header } from '../connected-components'
  import { deleteGame, listCatalog, listGames, playerGames } from '../stores'

  let gameToDelete = null
  let catalog = null
  let hasUser = false

  $: if ($session.user) {
    hasUser = true
    listGames()
    fetchCatalog()
  } else {
    hasUser = false
    fetchCatalog()
  }

  async function handleNewGame({ detail: { name } }) {
    goto(`/game/new?name=${encodeURIComponent(name)}`)
  }

  async function handleDeleteGame({ detail: game }) {
    gameToDelete = game
  }

  async function handleDeletionClose({ detail: confirmed } = {}) {
    if (confirmed) {
      await deleteGame(gameToDelete.id)
    }
    gameToDelete = null
  }

  async function fetchCatalog() {
    catalog = await listCatalog()
  }
</script>

<svelte:head>
  <title>{$_('page-titles.home')}</title>
</svelte:head>

<main>
  <Header>
    <h1>
      {$_(hasUser ? 'titles.home' : 'titles.welcome', $session.user)}
    </h1>
  </Header>

  <div>
    {#if hasUser}
      <h2>{$_('titles.your-games')}</h2>
      <section aria-roledescription="games">
        {#each $playerGames.sort((a, b) => b.created - a.created) as game (game.id)}
          <GameLink
            {game}
            playerId={$session.user?.id}
            on:delete={handleDeleteGame}
          />
        {:else}
          <span class="no-games">{$_('labels.no-games-yet')}</span>
        {/each}
      </section>
    {/if}

    <h2>{$_('titles.catalog')}</h2>
    <section aria-roledescription="catalog">
      {#if !catalog}
        <Progress />
      {:else}
        {#each catalog as game}
          <CatalogItem {game} on:click={handleNewGame} />
        {/each}
      {/if}
    </section>
  </div>
</main>

{#if gameToDelete}
  <ConfirmDialogue
    open
    title={$_('titles.confirm-game-deletion')}
    message={$_('labels.confirm-game-deletion', gameToDelete.locales[$locale])}
    on:close={handleDeletionClose}
  />
{/if}

<style lang="postcss">
  main {
    @apply flex flex-col h-full w-full;
  }

  h1 {
    @apply text-3xl py-4;
  }

  h2 {
    @apply text-2xl py-4 lg:w-3/4 lg:mx-auto;
  }

  div {
    @apply flex-1 overflow-y-auto px-4 pb-4;
  }

  section {
    @apply grid mx-auto my-8 gap-8 grid-cols-1 w-10/12;
    @apply sm:grid-cols-3 lg:w-9/12 xl:w-7/12;
  }

  .no-games {
    @apply italic;
  }
</style>
