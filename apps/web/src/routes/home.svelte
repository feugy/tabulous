<script context="module">
</script>

<script>
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { _ } from 'svelte-intl'
  import {
    CatalogItem,
    ConfirmDialogue,
    GameLink,
    Progress
  } from '../components'
  import { Header } from '../connected-components'
  import {
    currentPlayer,
    createGame,
    deleteGame,
    listCatalog,
    listGames,
    playerGames
  } from '../stores'

  let gameToDelete = null

  onMount(() => listGames())

  async function handleNewGame({ detail: { name } }) {
    goto(`/game/${await createGame(name)}`)
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
</script>

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

<svelte:head>
  <title>{$_('page-titles.home')}</title>
</svelte:head>

<main>
  <Header>
    <h1>{$_('titles.home', $currentPlayer)}</h1>
  </Header>

  <div>
    <h2>{$_('titles.your-games')}</h2>
    <section>
      {#each $playerGames.sort((a, b) => b.created - a.created) as game (game.id)}
        <GameLink
          {game}
          playerId={$currentPlayer?.id}
          on:delete={handleDeleteGame}
        />
      {:else}
        <span class="no-games">{$_('labels.no-games-yet')}</span>
      {/each}
    </section>

    <h2>{$_('titles.catalog')}</h2>
    <section>
      {#await listCatalog()}
        <Progress />
      {:then catalog}
        {#each catalog as game}
          <CatalogItem {game} on:click={handleNewGame} />{/each}
      {/await}
    </section>
  </div>
</main>

{#if gameToDelete}
  <ConfirmDialogue
    open
    title={$_('titles.confirm-game-deletion')}
    message={$_('labels.confirm-game-deletion', {
      kind: $_(`games.${gameToDelete.kind}`)
    })}
    on:close={handleDeletionClose}
  />
{/if}
