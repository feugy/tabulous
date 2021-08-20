<script>
  import { push } from 'svelte-spa-router'
  import { _ } from 'svelte-intl'
  import { Button, Dialogue, GameLink } from '../components'
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
    @apply flex gap-2 absolute -bottom-4 right-0;
  }

  main {
    @apply grid mx-auto my-8 gap-8 grid-cols-3;
    @apply md:w-10/12 lg:w-9/12 xl:w-7/12;
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
      playerId={$currentPlayer.id}
      on:delete={handleDeleteGame}
    />
  {/each}
</main>

{#if gameToDelete}
  <Dialogue
    open
    title={$_('titles.confirm-game-deletion')}
    on:close={handleDeletionClose}
  >
    <span
      >{$_('labels.confirm-game-deletion', {
        kind: $_(`games.${gameToDelete.kind}`)
      })}</span
    >
    <svelte:fragment slot="buttons">
      <Button
        secondary
        text={$_('actions.cancel')}
        on:click={() => handleDeletionClose({ detail: false })}
      />
      <Button
        text={$_('actions.confirm')}
        on:click={() => handleDeletionClose({ detail: true })}
      />
    </svelte:fragment>
  </Dialogue>
{/if}
