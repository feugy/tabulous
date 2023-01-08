<script>
  import {
    ConfirmDialogue,
    GameAside,
    Header,
    InvitePlayerDialogue,
    PageFooter
  } from '@src/components'
  import {
    connected,
    createGame,
    currentGame,
    deleteGame,
    gamePlayerById,
    isDifferentGame,
    joinGame,
    leaveGame,
    promoteGame,
    receiveGameListUpdates,
    sendToThread,
    thread,
    toastError,
    toastInfo
  } from '@src/stores'
  import { isLobby, translateError } from '@src/utils'
  import { readable } from 'svelte/store'
  import { _, locale } from 'svelte-intl'

  import { browser } from '$app/environment'
  import { beforeNavigate, goto } from '$app/navigation'
  import { page } from '$app/stores'

  import CatalogItem from './CatalogItem.svelte'
  import CreateLobby from './CreateLobby.svelte'
  import GameLink from './GameLink.svelte'

  /** @type {import('./$types').PageData} */
  export let data = {}

  let gameToDelete = null
  let user = null
  let games$ = readable(data.currentGames || [])
  let gameToInvite = false
  $: isDeletedLobby = isLobby(gameToDelete)

  if (data.session?.player) {
    user = data.session.player
    games$ = receiveGameListUpdates(data.currentGames)
  }

  $: if (browser && $page.url.searchParams.get('game-name')) {
    $page.url.searchParams.delete('game-name')
    goto($page.url.toString())
  }

  $: if (data.creationError) {
    toastError({ content: translateError($_, data.creationError) })
  }

  beforeNavigate(({ to }) => {
    if (user && isDifferentGame(to?.params?.gameId)) {
      leaveGame(user)
    }
  })

  function handleSelectGame({ detail: game }) {
    if (isLobby(game)) {
      leaveGame(user)
      enterGame(game)
    } else {
      goto(`/game/${game.id}`)
    }
  }

  async function handleDeleteGame({ detail: game }) {
    gameToDelete = game
  }

  async function handleDeletionClose({ detail: confirmed } = {}) {
    if (confirmed) {
      await deleteGame(gameToDelete.id)
      toastInfo({
        contentKey: isDeletedLobby
          ? 'labels.lobby-deleted'
          : 'labels.game-deleted'
      })
    }
    gameToDelete = null
  }

  async function handleCreateGame({ detail: name }) {
    if ($currentGame) {
      const gameId = $currentGame.id
      await promoteGame(gameId, name)
    } else {
      let creationUrl = `/home?game-name=${encodeURIComponent(name)}`
      if (user) {
        goto(creationUrl)
      } else {
        goto(`login?redirect=${encodeURIComponent(creationUrl)}`)
      }
    }
  }

  async function handleCreateLobby() {
    gameToInvite = await createGame()
    await enterGame(gameToInvite)
  }

  function enterGame(game) {
    return joinGame({
      gameId: game.id,
      ...data.session,
      onPromotion: promoted => {
        handleSelectGame({ detail: promoted })
      }
    })
  }

  function handleCloseLobby() {
    leaveGame(user)
  }
</script>

<svelte:head>
  <title>{$_('page-titles.home')}</title>
</svelte:head>

<main>
  <div class="column">
    <Header {user} breadcrumb={[{ label: $_('labels.home') }]}>
      <h1>
        {$_(user ? 'titles.home' : 'titles.welcome', user)}
      </h1>
    </Header>

    <div class="content">
      <i id="top" />

      {#if user}
        <h2>{$_('titles.your-games')}</h2>
        <section aria-roledescription="games">
          {#each $games$.sort((a, b) => b.created - a.created) as game (game.id)}
            <GameLink
              {game}
              playerId={user.id}
              isCurrent={game.id === $currentGame?.id}
              on:select={handleSelectGame}
              on:delete={handleDeleteGame}
              on:close={handleCloseLobby}
              on:invite={() => (gameToInvite = game)}
            />
          {:else}
            <span class="no-games">{$_('labels.no-games-yet')}</span>
          {/each}
        </section>
      {/if}

      <h2>{$_('titles.catalog')}</h2>
      <section aria-roledescription="catalog">
        {#if user}
          <CreateLobby on:select={handleCreateLobby} />
        {/if}
        {#each data.catalog as game}
          <CatalogItem {game} on:select={handleCreateGame} />
        {/each}
      </section>
      <span class="flex-1" />
      <PageFooter />
    </div>
  </div>
  {#if user}
    <GameAside
      game={$currentGame}
      player={user}
      playerById={$gamePlayerById}
      connected={$connected}
      thread={$thread}
      on:sendMessage={({ detail }) => sendToThread(detail.text)}
    />
  {/if}
</main>

{#if gameToInvite}
  <InvitePlayerDialogue
    game={gameToInvite}
    open
    on:close={() => (gameToInvite = null)}
  />
{/if}
{#if gameToDelete}
  <ConfirmDialogue
    open
    title={$_(
      isDeletedLobby
        ? 'titles.confirm-lobby-deletion'
        : 'titles.confirm-game-deletion'
    )}
    message={$_(
      isDeletedLobby
        ? 'labels.confirm-lobby-deletion'
        : 'labels.confirm-game-deletion',
      gameToDelete.locales?.[$locale]
    )}
    on:close={handleDeletionClose}
  />
{/if}

<style lang="postcss">
  main {
    @apply absolute inset-0 flex items-stretch overflow-hidden;
  }

  .column {
    @apply flex flex-col w-full p-0;
  }

  h1 {
    @apply text-3xl py-4;
  }

  h2 {
    @apply text-2xl py-4 w-3/4 mx-auto;
  }

  .content {
    @apply flex flex-col flex-1 overflow-y-auto p-0;
  }

  section {
    @apply grid grid-cols-3 mx-auto my-8 gap-8 w-9/12;
  }

  .no-games {
    @apply italic;
  }
</style>
