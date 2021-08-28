<script>
  import { push } from 'svelte-spa-router'
  import { _ } from 'svelte-intl'
  import { Button, ConfirmDialogue, GameLink } from '../components'
  import { Header } from '../connected-components'
  import {
    currentPlayer,
    createGame,
    deleteGame,
    playerGames,
    listGames
  } from '../stores'

  let gameToDelete = null

  listGames()

  async function handleNewGame() {
    push(`/game/${await createGame()}`)
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

<style type="postcss">
  h1 {
    @apply text-3xl py-4;
  }

  .action {
    @apply flex gap-2 justify-center pb-2 sm:absolute sm:-bottom-4 sm:right-0;
  }

  main {
    @apply grid mx-auto my-8 gap-8 grid-cols-1 w-10/12;
    @apply xs:grid-cols-2 sm:grid-cols-3 lg:w-9/12 xl:w-7/12;
  }
</style>

<svelte:head>
  <title>{$_('page-titles.home')}</title>
</svelte:head>

<Header>
  <h1>{$_('titles.home', $currentPlayer)}</h1>
  <span class="action">
    <Button
      icon="games"
      text={$_('actions.new-game')}
      on:click={handleNewGame}
    />
  </span>
</Header>

<main>
  {#each $playerGames as game (game.id)}
    <GameLink
      {game}
      playerId={$currentPlayer?.id}
      on:delete={handleDeleteGame}
    />
  {/each}
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
