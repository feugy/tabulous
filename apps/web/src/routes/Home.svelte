<script>
  import { push } from 'svelte-spa-router'
  import { _ } from 'svelte-intl'
  import { Button } from '../components'
  import { Header, JoinGameDialogue } from '../connected-components'
  import { currentUser, createGame } from '../stores'

  let openJoinGame = false

  async function handleNewGame() {
    push(`/game/${await createGame()}`)
  }
</script>

<style type="postcss">
  h1 {
    @apply text-3xl my-2;
  }

  .action {
    @apply flex gap-2 absolute -bottom-4 right-0;
  }
</style>

<svelte:head>
  <title>{$_('page-titles.home')}</title>
</svelte:head>

<Header>
  <h1>{$_('titles.home', $currentUser)}</h1>
  <span class="action">
    <Button
      icon="games"
      text={$_('actions.new-game')}
      on:click={handleNewGame}
    />
    <Button
      icon="connect_without_contact"
      text={$_('actions.join-game')}
      on:click={() => (openJoinGame = true)}
    />
  </span>
</Header>
<JoinGameDialogue
  open={openJoinGame}
  on:close={() => (openJoinGame = false)}
  on:game-joined
/>
