<script>
  import { push } from 'svelte-spa-router'
  import { _ } from 'svelte-intl'
  import { Button, GameLink } from '../components'
  import { Header } from '../connected-components'
  import { currentPlayer, createGame, playerGames, listGames } from '../stores'

  listGames()

  async function handleNewGame() {
    push(`/game/${await createGame()}`)
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
    <GameLink {game} />
  {/each}
</main>
